/**
 * API: /api/categoria-imagenes
 *
 * Gestiona la asociación entre una categoría y su imagen.
 * Usa la tabla auxiliar `categoria_imagenes` y el bucket `galeria`
 * (subcarpeta `categorias/`). No modifica ninguna tabla existente.
 *
 * GET    → devuelve todas las filas de categoria_imagenes
 * POST   → sube imagen al storage y registra la URL en la tabla
 * DELETE → elimina el archivo del storage y la fila de la tabla
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const BUCKET  = 'galeria'
const FOLDER  = 'categorias'

// ── GET: listar imágenes por categoría ──────────────────────────
export async function GET() {
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('categoria_imagenes')
    .select('id, categoria_id, imagen_url, created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── POST: subir imagen y registrar en tabla ──────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createAdminClient()

  const formData    = await request.formData()
  const file        = formData.get('file') as File | null
  const categoriaId = formData.get('categoria_id') as string | null

  if (!file || !categoriaId) {
    return NextResponse.json({ error: 'file y categoria_id son requeridos' }, { status: 400 })
  }

  // Validar tipo MIME
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Usa JPEG, PNG, WebP o GIF.' }, { status: 400 })
  }

  // Validar tamaño (máx 5 MB, igual que el bucket)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'La imagen no puede superar 5 MB.' }, { status: 400 })
  }

  // ── Eliminar imagen anterior si existe ──────────────────────
  const { data: existing } = await supabase
    .from('categoria_imagenes')
    .select('imagen_url')
    .eq('categoria_id', categoriaId)
    .maybeSingle()

  if (existing?.imagen_url) {
    // Extraer la ruta relativa dentro del bucket
    const oldPath = extractStoragePath(existing.imagen_url, BUCKET)
    if (oldPath) {
      await supabase.storage.from(BUCKET).remove([oldPath])
    }
  }

  // ── Subir nueva imagen ────────────────────────────────────────
  const ext      = file.name.split('.').pop() ?? 'jpg'
  const fileName = `${FOLDER}/${categoriaId}.${ext}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, {
      contentType:  file.type,
      upsert:       true,          // reemplaza si ya existía
      cacheControl: '3600',
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // ── Obtener URL pública ───────────────────────────────────────
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName)

  // ── Upsert en tabla auxiliar ──────────────────────────────────
  const { error: dbError } = await supabase
    .from('categoria_imagenes')
    .upsert(
      { categoria_id: categoriaId, imagen_url: publicUrl },
      { onConflict: 'categoria_id' }
    )

  if (dbError) {
    // Intentar limpiar el archivo subido si falla la BD
    await supabase.storage.from(BUCKET).remove([fileName])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ imagen_url: publicUrl })
}

// ── DELETE: eliminar imagen ───────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const supabase    = await createAdminClient()
  const { categoriaId } = await request.json() as { categoriaId: string }

  if (!categoriaId) {
    return NextResponse.json({ error: 'categoria_id es requerido' }, { status: 400 })
  }

  // Buscar la URL actual
  const { data: existing } = await supabase
    .from('categoria_imagenes')
    .select('imagen_url')
    .eq('categoria_id', categoriaId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'No existe imagen para esta categoría' }, { status: 404 })
  }

  // Eliminar del storage
  const storagePath = extractStoragePath(existing.imagen_url, BUCKET)
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath])
  }

  // Eliminar de la tabla
  const { error } = await supabase
    .from('categoria_imagenes')
    .delete()
    .eq('categoria_id', categoriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// ── Utilidad: extrae la ruta relativa desde una URL pública ──────
function extractStoragePath(publicUrl: string, bucket: string): string | null {
  try {
    const url  = new URL(publicUrl)
    // La URL pública tiene forma: .../storage/v1/object/public/<bucket>/<path>
    const marker = `/object/public/${bucket}/`
    const idx    = url.pathname.indexOf(marker)
    if (idx === -1) return null
    return url.pathname.slice(idx + marker.length)
  } catch {
    return null
  }
}

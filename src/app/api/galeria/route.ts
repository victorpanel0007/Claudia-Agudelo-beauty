import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

// GET — público, para el sitio web
export async function GET() {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('galeria')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=60' } })
}

// POST — subir nueva foto (solo admin)
export async function POST(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden()
  const supabase = await createAdminClient()
  const body = await request.json()
  const { url, storage_path, categoria, descripcion, orden } = body
  if (!url || !storage_path) return NextResponse.json({ error: 'url y storage_path requeridos' }, { status: 400 })

  const { data, error } = await supabase
    .from('galeria')
    .insert({ url, storage_path, categoria: categoria || 'General', descripcion: descripcion || null, orden: orden ?? 0 })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE — eliminar foto (solo admin)
export async function DELETE(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden()
  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const storagePath = searchParams.get('path')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  // Eliminar del storage
  if (storagePath) {
    await supabase.storage.from('galeria').remove([storagePath])
  }

  const { error } = await supabase.from('galeria').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — actualizar orden/categoria
export async function PATCH(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden()
  const supabase = await createAdminClient()
  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const { data, error } = await supabase.from('galeria').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

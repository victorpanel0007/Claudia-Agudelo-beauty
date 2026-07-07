import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

// GET — público (la agenda pública y el bot los necesitan)
export async function GET(request: NextRequest) {
  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const activo = searchParams.get('activo')
  const search = searchParams.get('search')

  let query = supabase
    .from('servicios')
    .select('*, categoria:categorias(id, nombre, icono, orden)')
    .order('nombre')

  if (activo === 'true')  query = query.eq('activo', true)
  if (activo === 'false') query = query.eq('activo', false)
  if (search)             query = query.ilike('nombre', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

// POST — solo admin
export async function POST(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Solo administradores pueden crear servicios')

  const supabase = await createAdminClient()
  const body = await request.json()

  const { nombre, categoria_id, tipo_precio, precio, precio_desde,
          duracion_minutos, requiere_valoracion, descripcion } = body

  if (!nombre?.trim())    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  if (!categoria_id)      return NextResponse.json({ error: 'La categoría es requerida' }, { status: 400 })
  if (!duracion_minutos)  return NextResponse.json({ error: 'La duración es requerida' }, { status: 400 })

  const payload = {
    nombre:              nombre.trim(),
    categoria_id,
    tipo_precio:         tipo_precio ?? 'fijo',
    duracion_minutos:    Number(duracion_minutos),
    requiere_valoracion: Boolean(requiere_valoracion),
    descripcion:         descripcion?.trim() || null,
    activo:              true,
    precio:       tipo_precio === 'fijo'   && precio        ? Number(precio)        : null,
    precio_desde: tipo_precio === 'desde'  && precio_desde  ? Number(precio_desde)  : null,
  }

  const { data, error } = await supabase.from('servicios').insert(payload).select()
  if (error) {
    console.error('[API /servicios POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data?.[0] ?? data, { status: 201 })
}

// PATCH — solo admin
export async function PATCH(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Solo administradores pueden editar servicios')

  const supabase = await createAdminClient()
  const body = await request.json()
  const { id, ...rest } = body

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const payload: Record<string, unknown> = {}
  if (rest.nombre !== undefined)              payload.nombre              = rest.nombre.trim()
  if (rest.categoria_id !== undefined)        payload.categoria_id        = rest.categoria_id
  if (rest.tipo_precio !== undefined)         payload.tipo_precio         = rest.tipo_precio
  if (rest.duracion_minutos !== undefined)    payload.duracion_minutos    = Number(rest.duracion_minutos)
  if (rest.requiere_valoracion !== undefined) payload.requiere_valoracion = Boolean(rest.requiere_valoracion)
  if (rest.descripcion !== undefined)         payload.descripcion         = rest.descripcion?.trim() || null
  if (rest.activo !== undefined)              payload.activo              = Boolean(rest.activo)
  payload.precio       = rest.tipo_precio === 'fijo'  && rest.precio      ? Number(rest.precio)       : null
  payload.precio_desde = rest.tipo_precio === 'desde' && rest.precio_desde ? Number(rest.precio_desde) : null

  console.log('[PATCH /servicios] id:', id, '| payload:', JSON.stringify(payload))

  // Verificar que el servicio existe antes de actualizar
  const { data: existing } = await supabase.from('servicios').select('id, categoria_id').eq('id', id).maybeSingle()
  if (!existing) {
    console.error('[PATCH /servicios] ID no existe en BD:', id)
    // Intentar buscar por nombre como fallback
    if (rest.nombre) {
      const { data: byName } = await supabase
        .from('servicios').select('id').ilike('nombre', rest.nombre.trim()).maybeSingle()
      if (byName) {
        console.log('[PATCH /servicios] Usando id por nombre:', byName.id)
        const { data: d2, error: e2 } = await supabase
          .from('servicios').update(payload).eq('id', byName.id).select()
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json(d2?.[0] ?? {})
      }
    }
    return NextResponse.json({ error: `Servicio no encontrado (id: ${id})` }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('servicios')
    .update(payload)
    .eq('id', id)
    .select()

  if (error) {
    console.error('[API /servicios PATCH] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    console.error('[PATCH /servicios] UPDATE devolvió vacío para id:', id)
    // Si el update no devuelve filas, probablemente RLS está bloqueando
    // Verificar ejecutando en Supabase: ALTER TABLE servicios DISABLE ROW LEVEL SECURITY;
    return NextResponse.json({ error: 'RLS bloqueó el UPDATE. Ve a Supabase → Table Editor → servicios → Disable RLS' }, { status: 500 })
  }
  return NextResponse.json(data[0])
}

// DELETE — solo admin
export async function DELETE(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Solo administradores pueden eliminar servicios')

  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase.from('servicios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

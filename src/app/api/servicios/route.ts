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

  const { data, error } = await supabase.from('servicios').insert(payload).select().single()
  if (error) {
    console.error('[API /servicios POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
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
  payload.precio       = rest.tipo_precio === 'fijo'  && rest.precio      ? Number(rest.precio)      : null
  payload.precio_desde = rest.tipo_precio === 'desde' && rest.precio_desde ? Number(rest.precio_desde) : null

  const { data, error } = await supabase.from('servicios').update(payload).eq('id', id).select().single()
  if (error) {
    console.error('[API /servicios PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
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

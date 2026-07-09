import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  const rol = await getUserRole()
  if (!rol) return forbidden('No autorizado')

  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')

  let query = supabase
    .from('servicios_extras')
    .select('*, servicio:servicios(nombre), especialista:especialistas(nombre), cliente:clientes(nombre,telefono)')
    .order('created_at', { ascending: false })

  if (fecha) query = query.eq('fecha', fecha)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const rol = await getUserRole()
  if (!rol) return forbidden('No autorizado')

  const supabase = await createAdminClient()
  const body = await request.json()

  const {
    fecha, servicio_id, servicio_nombre, especialista_id, especialista_nombre,
    cliente_id, cliente_nombre, cliente_telefono, valor_final,
    es_nuevo_cliente,
  } = body

  if (!servicio_nombre?.trim()) return NextResponse.json({ error: 'Servicio requerido' }, { status: 400 })
  if (!cliente_nombre?.trim())  return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 })
  if (!fecha)                   return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })

  // Crear cliente nuevo si corresponde
  let finalClienteId = cliente_id ?? null
  if (es_nuevo_cliente && cliente_nombre.trim()) {
    const { data: existing } = await supabase
      .from('clientes').select('id').eq('telefono', cliente_telefono ?? '').maybeSingle()
    if (existing) {
      finalClienteId = existing.id
    } else {
      const { data: nuevo } = await supabase
        .from('clientes')
        .insert({ nombre: cliente_nombre.trim(), telefono: cliente_telefono ?? '' })
        .select('id').single()
      finalClienteId = nuevo?.id ?? null
    }
  }

  const payload = {
    fecha,
    servicio_id:         servicio_id ?? null,
    servicio_nombre:     servicio_nombre.trim(),
    especialista_id:     especialista_id ?? null,
    especialista_nombre: especialista_nombre ?? null,
    cliente_id:          finalClienteId,
    cliente_nombre:      cliente_nombre.trim(),
    cliente_telefono:    cliente_telefono ?? null,
    valor_final:         Number(valor_final) || 0,
    canal:               'admin',
  }

  const { data, error } = await supabase.from('servicios_extras').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Solo administradores')

  const supabase = await createAdminClient()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase.from('servicios_extras').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

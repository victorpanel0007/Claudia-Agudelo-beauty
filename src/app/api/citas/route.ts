import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  const especialistaId = searchParams.get('especialista_id')
  const estado = searchParams.get('estado')

  let query = supabase
    .from('citas')
    .select(`
      *,
      cliente:clientes(id, nombre, telefono),
      especialista:especialistas(id, nombre, foto),
      servicio:servicios(id, nombre, duracion_minutos, precio, precio_desde, tipo_precio)
    `)
    .order('fecha_inicio', { ascending: true })

  if (fecha) {
    const start = new Date(fecha)
    start.setHours(0, 0, 0, 0)
    const end = new Date(fecha)
    end.setHours(23, 59, 59, 999)
    query = query.gte('fecha_inicio', start.toISOString()).lte('fecha_inicio', end.toISOString())
  }
  if (especialistaId) query = query.eq('especialista_id', especialistaId)
  if (estado) query = query.eq('estado', estado)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createAdminClient()
  const body = await request.json()

  try {
    let clienteId: string = body.cliente_id

    // Si viene nombre_cliente (desde web pública), buscar o crear el cliente
    if (!clienteId && body.nombre_cliente) {
      const telefono = (body.telefono || '').trim()
      const nombre  = (body.nombre_cliente || '').trim()

      // Buscar cliente existente por teléfono
      const { data: existing } = await supabase
        .from('clientes')
        .select('id')
        .eq('telefono', telefono)
        .maybeSingle()

      if (existing) {
        clienteId = existing.id
      } else {
        // Crear nuevo cliente
        const { data: nuevo, error: errCliente } = await supabase
          .from('clientes')
          .insert({ nombre, telefono })
          .select('id')
          .single()
        if (errCliente) {
          return NextResponse.json({ error: errCliente.message }, { status: 500 })
        }
        clienteId = nuevo.id
      }
    }

    if (!clienteId) {
      return NextResponse.json({ error: 'Se requiere cliente_id o nombre_cliente' }, { status: 400 })
    }

    // Si no hay servicio_id pero hay nombre del servicio, buscarlo en la DB
    let servicioId = body.servicio_id || null
    if (!servicioId && body.servicio_nombre) {
      const { data: srv } = await supabase
        .from('servicios')
        .select('id')
        .ilike('nombre', body.servicio_nombre)
        .maybeSingle()
      if (srv) servicioId = srv.id
    }

    // Campos que van a la tabla citas
    const citaData = {
      cliente_id:       clienteId,
      especialista_id:  body.especialista_id   || null,
      servicio_id:      servicioId,
      fecha_inicio:     body.fecha_inicio,
      fecha_fin:        body.fecha_fin,
      estado:           body.estado             || 'confirmada',
      valor_final:      body.valor_final        || null,
      observaciones:    body.observaciones      || null,
      canal:            body.canal              || 'web',
    }

    const { data, error } = await supabase
      .from('citas')
      .insert(citaData)
      .select(`
        *,
        cliente:clientes(id, nombre, telefono),
        especialista:especialistas(id, nombre, foto),
        servicio:servicios(id, nombre, duracion_minutos)
      `)
      .single()

    if (error) {
      console.error('Error creando cita:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })

  } catch (err) {
    console.error('Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

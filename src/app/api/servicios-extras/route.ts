import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

// Los servicios extras se almacenan como citas normales con canal='extra'
// Esto los incluye automáticamente en reportes, comisiones e historial del cliente.
// La hora se fija a medianoche (00:00) para no bloquear ningún slot real.

export async function GET(request: NextRequest) {
  const rol = await getUserRole()
  if (!rol) return forbidden('No autorizado')

  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha') // YYYY-MM-DD

  let query = supabase
    .from('citas')
    .select(`
      id, valor_final, fecha_inicio, canal,
      cliente:clientes(nombre, telefono),
      servicio:servicios(nombre),
      especialista:especialistas(nombre)
    `)
    .eq('canal', 'extra')
    .eq('estado', 'completada')
    .order('fecha_inicio', { ascending: true })

  if (fecha) {
    query = query
      .gte('fecha_inicio', `${fecha}T00:00:00-05:00`)
      .lte('fecha_inicio', `${fecha}T23:59:59-05:00`)
  }

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
    fecha, servicio_id, especialista_id,
    cliente_id, cliente_nombre, cliente_telefono,
    valor_final, es_nuevo_cliente,
  } = body

  if (!servicio_id)             return NextResponse.json({ error: 'Servicio requerido' }, { status: 400 })
  if (!cliente_nombre?.trim())  return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 })
  if (!fecha)                   return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })
  if (!especialista_id)         return NextResponse.json({ error: 'Especialista requerida' }, { status: 400 })

  // Crear o buscar cliente
  let finalClienteId = cliente_id ?? null
  if (es_nuevo_cliente || !finalClienteId) {
    const tel = (cliente_telefono ?? '').trim()
    if (tel) {
      const { data: existing } = await supabase
        .from('clientes').select('id').eq('telefono', tel).maybeSingle()
      if (existing) {
        finalClienteId = existing.id
      } else {
        const { data: nuevo } = await supabase
          .from('clientes')
          .insert({ nombre: cliente_nombre.trim(), telefono: tel })
          .select('id').single()
        finalClienteId = nuevo?.id ?? null
      }
    } else if (!finalClienteId) {
      const { data: nuevo } = await supabase
        .from('clientes')
        .insert({ nombre: cliente_nombre.trim(), telefono: '' })
        .select('id').single()
      finalClienteId = nuevo?.id ?? null
    }
  }

  if (!finalClienteId) return NextResponse.json({ error: 'Error creando cliente' }, { status: 500 })

  // Usar hora 00:00:01 para que no bloquee slots reales
  // La duración es 1 minuto — no ocupa ningún slot de 30 min
  const fechaInicio = `${fecha}T00:00:01-05:00`
  const fechaFin    = `${fecha}T00:01:00-05:00`

  // Obtener porcentaje de comisión de la especialista
  const { data: comConfig } = await supabase
    .from('comisiones_config')
    .select('porcentaje')
    .eq('especialista_id', especialista_id)
    .maybeSingle()

  const porcentaje = comConfig?.porcentaje ?? 40
  const valor = Number(valor_final) || 0
  const comision = Math.round(valor * (porcentaje / 100))
  const ganancia = valor - comision

  const { data, error } = await supabase
    .from('citas')
    .insert({
      cliente_id:           finalClienteId,
      especialista_id,
      servicio_id,
      fecha_inicio:         fechaInicio,
      fecha_fin:            fechaFin,
      estado:               'completada',
      canal:                'extra',
      valor_final:          valor,
      porcentaje_comision:  porcentaje,
      comision_especialista: comision,
      ganancia_spa:         ganancia,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[servicios-extras POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Solo administradores')

  const supabase = await createAdminClient()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase.from('citas').delete().eq('id', id).eq('canal', 'extra')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

// Solo devuelve comisiones de la especialista autenticada — nunca de otras
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.user_metadata?.rol === 'admin') {
    return NextResponse.json({ error: 'Usa /api/comisiones para admins' }, { status: 403 })
  }

  const especialistaId = user.user_metadata?.especialista_id as string | undefined
  if (!especialistaId) {
    return NextResponse.json({ error: 'Usuario no vinculado a especialista' }, { status: 400 })
  }

  const adminSb = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  // Porcentaje de comisión
  const { data: config } = await adminSb
    .from('comisiones_config')
    .select('porcentaje')
    .eq('especialista_id', especialistaId)
    .maybeSingle()
  const porcentaje = (config?.porcentaje as number | null) ?? 40

  // Citas completadas del período
  let citasQ = adminSb
    .from('citas')
    .select('id, fecha_inicio, fecha_fin, valor_final, porcentaje_comision, comision_especialista, pago_estado, servicio:servicios(nombre)')
    .eq('especialista_id', especialistaId)
    .eq('estado', 'completada')
    .order('fecha_inicio', { ascending: false })

  if (desde) citasQ = citasQ.gte('fecha_inicio', desde + 'T00:00:00-05:00')
  if (hasta) citasQ = citasQ.lte('fecha_inicio', hasta + 'T23:59:59-05:00')

  const { data: citas, error: citasErr } = await citasQ
  if (citasErr) return NextResponse.json({ error: citasErr.message }, { status: 500 })

  // Pagos recibidos del período
  let pagosQ = adminSb
    .from('pagos_especialistas')
    .select('id, fecha, periodo, valor_pagado, metodo_pago, observaciones')
    .eq('especialista_id', especialistaId)
    .order('fecha', { ascending: false })

  if (desde) pagosQ = pagosQ.gte('fecha', desde)
  if (hasta) pagosQ = pagosQ.lte('fecha', hasta)

  const { data: pagos, error: pagosErr } = await pagosQ
  if (pagosErr) return NextResponse.json({ error: pagosErr.message }, { status: 500 })

  return NextResponse.json({ porcentaje, citas: citas ?? [], pagos: pagos ?? [] })
}

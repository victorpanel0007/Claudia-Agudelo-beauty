import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppReminder } from '@/lib/evolution-api'
import { formatDate, formatTime } from '@/lib/utils'

export async function POST(request: NextRequest) {
  // This endpoint is called by a cron job (Vercel Cron / external scheduler)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const now = new Date()

  // 24h reminders
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in24hEnd = new Date(in24h.getTime() + 30 * 60 * 1000)

  // 2h reminders
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const in2hEnd = new Date(in2h.getTime() + 30 * 60 * 1000)

  const { data: citas24h } = await supabase
    .from('citas')
    .select(`*, cliente:clientes(telefono), servicio:servicios(nombre)`)
    .gte('fecha_inicio', in24h.toISOString())
    .lte('fecha_inicio', in24hEnd.toISOString())
    .eq('estado', 'confirmada')

  const { data: citas2h } = await supabase
    .from('citas')
    .select(`*, cliente:clientes(telefono), servicio:servicios(nombre)`)
    .gte('fecha_inicio', in2h.toISOString())
    .lte('fecha_inicio', in2hEnd.toISOString())
    .eq('estado', 'confirmada')

  let sent = 0

  for (const cita of [...(citas24h || []), ...(citas2h || [])]) {
    if (cita.cliente?.telefono && cita.servicio?.nombre) {
      await sendWhatsAppReminder(
        cita.cliente.telefono,
        cita.servicio.nombre,
        formatDate(cita.fecha_inicio),
        formatTime(cita.fecha_inicio)
      )
      sent++
    }
  }

  return NextResponse.json({ sent })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/evolution-api'
import { formatDate, formatTime } from '@/lib/utils'

// ── Auth del cron ─────────────────────────────────────────────────────────────
// Vercel llama con GET y el header Authorization: Bearer <CRON_SECRET>

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return await runReminders()
}

// También soportar POST para pruebas manuales desde el admin
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return await runReminders()
}

async function runReminders() {
  const supabase = await createAdminClient()
  const now = new Date()

  // ── Leer configuración desde Supabase ────────────────────────────────────
  const { data: config } = await supabase
    .from('config_recordatorios')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  // Si no hay config o está desactivado, no hacer nada
  if (!config || !config.activo) {
    return NextResponse.json({ skipped: true, reason: 'Recordatorios desactivados' })
  }

  const resultados: { cita_id: string; tipo: string; ok: boolean; error?: string }[] = []

  // ── Ventana de búsqueda: ±15 min alrededor del objetivo ──────────────────
  const VENTANA = 15 * 60 * 1000

  // ── Recordatorio 24h ─────────────────────────────────────────────────────
  if (config.recordatorio_24h) {
    const target24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const target24hMin = new Date(target24h.getTime() - VENTANA)
    const target24hMax = new Date(target24h.getTime() + VENTANA)

    const { data: citas24h } = await supabase
      .from('citas')
      .select('*, cliente:clientes(nombre, telefono), servicio:servicios(nombre), especialista:especialistas(nombre, whatsapp, notificaciones)')
      .eq('estado', 'confirmada')
      .eq('recordatorio_24h_enviado', false)
      .gte('fecha_inicio', target24hMin.toISOString())
      .lte('fecha_inicio', target24hMax.toISOString())

    for (const cita of citas24h || []) {
      // Enviar al cliente
      if (cita.cliente?.telefono) {
        const msg = buildMensajeCliente(config, cita, '24h')
        const res = await sendWhatsAppMessage(cita.cliente.telefono, msg)
        resultados.push({ cita_id: cita.id, tipo: 'cliente_24h', ok: res.ok, error: res.errorMessage })
      }

      // Notificar especialista si está configurado
      if (config.notificar_especialista && cita.especialista?.whatsapp && cita.especialista?.notificaciones) {
        const msg = buildMensajeEspecialista(cita, '24h')
        await sendWhatsAppMessage(cita.especialista.whatsapp, msg)
      }

      // Marcar como enviado
      await supabase
        .from('citas')
        .update({ recordatorio_24h_enviado: true, fecha_recordatorio_24h: now.toISOString() })
        .eq('id', cita.id)
    }
  }

  // ── Recordatorio 2h ───────────────────────────────────────────────────────
  if (config.recordatorio_2h) {
    const target2h    = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const target2hMin = new Date(target2h.getTime() - VENTANA)
    const target2hMax = new Date(target2h.getTime() + VENTANA)

    const { data: citas2h } = await supabase
      .from('citas')
      .select('*, cliente:clientes(nombre, telefono), servicio:servicios(nombre), especialista:especialistas(nombre, whatsapp, notificaciones)')
      .eq('estado', 'confirmada')
      .eq('recordatorio_2h_enviado', false)
      .gte('fecha_inicio', target2hMin.toISOString())
      .lte('fecha_inicio', target2hMax.toISOString())

    for (const cita of citas2h || []) {
      if (cita.cliente?.telefono) {
        const msg = buildMensajeCliente(config, cita, '2h')
        const res = await sendWhatsAppMessage(cita.cliente.telefono, msg)
        resultados.push({ cita_id: cita.id, tipo: 'cliente_2h', ok: res.ok, error: res.errorMessage })
      }

      if (config.notificar_especialista && cita.especialista?.whatsapp && cita.especialista?.notificaciones) {
        const msg = buildMensajeEspecialista(cita, '2h')
        await sendWhatsAppMessage(cita.especialista.whatsapp, msg)
      }

      await supabase
        .from('citas')
        .update({ recordatorio_2h_enviado: true, fecha_recordatorio_2h: now.toISOString() })
        .eq('id', cita.id)
    }
  }

  const sent  = resultados.filter(r => r.ok).length
  const failed = resultados.filter(r => !r.ok).length
  console.info(`[Cron Reminders] sent=${sent} failed=${failed}`)

  return NextResponse.json({ sent, failed, resultados })
}

// ── Builders de mensajes ─────────────────────────────────────────────────────

function buildMensajeCliente(config: Record<string, unknown>, cita: Record<string, unknown>, tipo: '24h' | '2h'): string {
  // Usar mensaje personalizado si existe
  const plantilla = tipo === '24h'
    ? (config.mensaje_24h as string | null)
    : (config.mensaje_2h as string | null)

  const cliente = (cita.cliente as { nombre?: string } | null)
  const servicio = (cita.servicio as { nombre?: string } | null)
  const especialista = (cita.especialista as { nombre?: string } | null)
  const fechaStr = formatDate(cita.fecha_inicio as string)
  const horaStr  = formatTime(cita.fecha_inicio as string)

  if (plantilla) {
    return plantilla
      .replace('{cliente}',     cliente?.nombre     || '')
      .replace('{servicio}',    servicio?.nombre    || '')
      .replace('{especialista}',especialista?.nombre || '')
      .replace('{fecha}',       fechaStr)
      .replace('{hora}',        horaStr)
  }

  const tiempoTexto = tipo === '24h' ? 'mañana' : 'en 2 horas'
  return `⏰ *Recordatorio de cita*

Hola *${cliente?.nombre || 'cliente'}* 👋

Te recordamos que tienes una cita *${tiempoTexto}*:

💅 Servicio: *${servicio?.nombre || 'Servicio'}*
👩 Especialista: *${especialista?.nombre || 'Especialista'}*
📅 Fecha: *${fechaStr}*
⏰ Hora: *${horaStr}*

Te esperamos en *Claudia Agudelo Beauty* 💖

¿Necesitas reprogramar? Escríbenos 😊`
}

function buildMensajeEspecialista(cita: Record<string, unknown>, tipo: '24h' | '2h'): string {
  const cliente = (cita.cliente as { nombre?: string } | null)
  const servicio = (cita.servicio as { nombre?: string } | null)
  const fechaStr = formatDate(cita.fecha_inicio as string)
  const horaStr  = formatTime(cita.fecha_inicio as string)
  const tiempoTexto = tipo === '24h' ? 'mañana' : 'en 2 horas'

  return `📋 *Recordatorio de cita — ${tiempoTexto}*

Cliente: *${cliente?.nombre || '—'}*
Servicio: *${servicio?.nombre || '—'}*
Fecha: *${fechaStr}*
Hora: *${horaStr}*

¡Que tengas una excelente atención! 💖`
}

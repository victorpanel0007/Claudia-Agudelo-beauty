import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { formatDate, formatTime } from '@/lib/utils'

// ── Envío vía backend de Railway (Meta Cloud API / Dualhook) ─────────────────
// El backend expone POST /api/messages/send con body { to, text }
// y usa META_ACCESS_TOKEN + DUALHOOK_PHONE_NUMBER_ID para enviar.

interface SendResult {
  ok: boolean
  errorMessage?: string
}

async function sendWhatsAppViaRailway(to: string, text: string): Promise<SendResult> {
  const backendUrl = process.env.WHATSAPP_BACKEND_URL
  if (!backendUrl) {
    console.error('[Cron] WHATSAPP_BACKEND_URL no configurado')
    return { ok: false, errorMessage: 'WHATSAPP_BACKEND_URL no configurado en variables de entorno' }
  }

  // Normalizar teléfono a formato 57XXXXXXXXXX
  const digits = to.replace(/\D/g, '')
  const phone = digits.startsWith('57') && digits.length === 12
    ? digits
    : digits.length === 10
      ? `57${digits}`
      : digits

  try {
    const res = await fetch(`${backendUrl}/api/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, text }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signal: (AbortSignal as any).timeout(10_000),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, errorMessage: `HTTP ${res.status} — ${JSON.stringify(err)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, errorMessage: (err as Error).message }
  }
}

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

  if (!config || !config.activo) {
    return NextResponse.json({ skipped: true, reason: 'Recordatorios desactivados' })
  }

  const resultados: { cita_id: string; tipo: string; ok: boolean; error?: string }[] = []

  // ── Estrategia para cron que corre UNA VEZ AL DÍA (plan Hobby Vercel) ────
  // En vez de buscar citas en ventana de ±15min (inútil con 1 ejecución/día),
  // buscamos TODAS las citas confirmadas de las próximas 48h que aún no
  // recibieron recordatorio y cuya hora ya corresponde enviar.

  // Obtener fecha actual en Colombia
  const colNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))

  // ── Recordatorio 24h ─────────────────────────────────────────────────────
  if (config.recordatorio_24h) {
    // Citas entre 20h y 28h desde ahora = mañana en ese rango horario
    const desde24h = new Date(now.getTime() + 20 * 60 * 60 * 1000)
    const hasta24h = new Date(now.getTime() + 28 * 60 * 60 * 1000)

    const { data: citas24h } = await supabase
      .from('citas')
      .select('*, cliente:clientes(nombre, telefono), servicio:servicios(nombre), especialista:especialistas(nombre, whatsapp, notificaciones)')
      .eq('estado', 'confirmada')
      .eq('recordatorio_24h_enviado', false)
      .gte('fecha_inicio', desde24h.toISOString())
      .lte('fecha_inicio', hasta24h.toISOString())

    for (const cita of citas24h || []) {
      if (cita.cliente?.telefono) {
        const msg = buildMensajeCliente(config, cita, '24h')
        const res = await sendWhatsAppViaRailway(cita.cliente.telefono, msg)
        resultados.push({ cita_id: cita.id, tipo: 'cliente_24h', ok: res.ok, error: res.errorMessage })
        if (res.ok) console.info(`[Cron] 24h → ${cita.cliente.telefono} (${cita.id})`)
      }

      if (config.notificar_especialista && cita.especialista?.whatsapp && cita.especialista?.notificaciones) {
        await sendWhatsAppViaRailway(cita.especialista.whatsapp, buildMensajeEspecialista(cita, '24h'))
      }

      await supabase.from('citas')
        .update({ recordatorio_24h_enviado: true, fecha_recordatorio_24h: now.toISOString() })
        .eq('id', cita.id)
    }
  }

  // ── Recordatorio 2h ───────────────────────────────────────────────────────
  // Busca citas entre ahora+30min y ahora+4h — cubre las del mismo día
  if (config.recordatorio_2h) {
    const desde2h = new Date(now.getTime() + 30 * 60 * 1000)        // +30 min
    const hasta2h = new Date(now.getTime() + 4 * 60 * 60 * 1000)    // +4 h

    const { data: citas2h } = await supabase
      .from('citas')
      .select('*, cliente:clientes(nombre, telefono), servicio:servicios(nombre), especialista:especialistas(nombre, whatsapp, notificaciones)')
      .eq('estado', 'confirmada')
      .eq('recordatorio_2h_enviado', false)
      .gte('fecha_inicio', desde2h.toISOString())
      .lte('fecha_inicio', hasta2h.toISOString())

    for (const cita of citas2h || []) {
      if (cita.cliente?.telefono) {
        const msg = buildMensajeCliente(config, cita, '2h')
        const res = await sendWhatsAppViaRailway(cita.cliente.telefono, msg)
        resultados.push({ cita_id: cita.id, tipo: 'cliente_2h', ok: res.ok, error: res.errorMessage })
        if (res.ok) console.info(`[Cron] 2h → ${cita.cliente.telefono} (${cita.id})`)
      }

      if (config.notificar_especialista && cita.especialista?.whatsapp && cita.especialista?.notificaciones) {
        await sendWhatsAppViaRailway(cita.especialista.whatsapp, buildMensajeEspecialista(cita, '2h'))
      }

      await supabase.from('citas')
        .update({ recordatorio_2h_enviado: true, fecha_recordatorio_2h: now.toISOString() })
        .eq('id', cita.id)
    }
  }

  const sent   = resultados.filter(r => r.ok).length
  const failed = resultados.filter(r => !r.ok).length
  console.info(`[Cron Reminders] ${new Date().toISOString()} sent=${sent} failed=${failed}`)

  return NextResponse.json({ sent, failed, resultados, ejecutado_en: now.toISOString() })
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

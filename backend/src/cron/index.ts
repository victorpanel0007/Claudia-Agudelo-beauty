/**
 * Cron Jobs — Railway Backend
 * Corre en el servidor Node.js 24/7, sin depender de Vercel Cron.
 *
 * Recordatorio 24h → cada hora en punto, busca citas de mañana
 * Recordatorio 2h  → cada hora en punto, busca citas en las próximas 2-4h
 */
import cron from 'node-cron'
import { cronLog } from '../config/logger'
import { getSupabase } from '../database/supabase'
import { sendText } from '../services/whatsapp.service'

// ── Helpers de formato ────────────────────────────────────────────────────────

function formatFechaColombia(isoString: string): string {
  return new Date(isoString).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatHoraColombia(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function normalizarTelefono(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  if (digits.startsWith('57') && digits.length === 12) return digits
  if (digits.length === 10) return `57${digits}`
  return digits
}

// ── Builder de mensajes ───────────────────────────────────────────────────────

function buildMensajeCliente(
  config: Record<string, unknown>,
  cita: Record<string, unknown>,
  tipo: '24h' | '2h'
): string {
  const plantilla = tipo === '24h'
    ? (config.mensaje_24h as string | null)
    : (config.mensaje_2h as string | null)

  const cliente    = (cita.cliente    as { nombre?: string } | null)
  const servicio   = (cita.servicio   as { nombre?: string } | null)
  const especialista = (cita.especialista as { nombre?: string } | null)
  const fechaStr   = formatFechaColombia(cita.fecha_inicio as string)
  const horaStr    = formatHoraColombia(cita.fecha_inicio as string)

  if (plantilla) {
    return plantilla
      .replace('{cliente}',      cliente?.nombre      ?? '')
      .replace('{servicio}',     servicio?.nombre     ?? '')
      .replace('{especialista}', especialista?.nombre ?? '')
      .replace('{fecha}',        fechaStr)
      .replace('{hora}',         horaStr)
  }

  const tiempoTexto = tipo === '24h' ? 'mañana' : 'en 2 horas'
  return `⏰ *Recordatorio de cita*

Hola *${cliente?.nombre ?? 'cliente'}* 👋

Te recordamos que tienes una cita *${tiempoTexto}*:

💅 Servicio: *${servicio?.nombre ?? 'Servicio'}*
👩 Especialista: *${especialista?.nombre ?? 'Especialista'}*
📅 Fecha: *${fechaStr}*
⏰ Hora: *${horaStr}*

Te esperamos en *Claudia Agudelo Beauty* 💖

¿Necesitas reprogramar? Escríbenos 😊`
}

function buildMensajeEspecialista(cita: Record<string, unknown>, tipo: '24h' | '2h'): string {
  const cliente    = (cita.cliente  as { nombre?: string } | null)
  const servicio   = (cita.servicio as { nombre?: string } | null)
  const fechaStr   = formatFechaColombia(cita.fecha_inicio as string)
  const horaStr    = formatHoraColombia(cita.fecha_inicio as string)
  const tiempoTexto = tipo === '24h' ? 'mañana' : 'en 2 horas'

  return `📋 *Recordatorio de cita — ${tiempoTexto}*

Cliente: *${cliente?.nombre ?? '—'}*
Servicio: *${servicio?.nombre ?? '—'}*
📅 Fecha: *${fechaStr}*
⏰ Hora: *${horaStr}*

¡Recuerda prepararte! 💪`
}

// ── Lógica principal ──────────────────────────────────────────────────────────

async function runReminders(): Promise<void> {
  const supabase = getSupabase()
  const now = new Date()

  // Leer configuración
  const { data: config, error: configError } = await supabase
    .from('config_recordatorios')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (configError) {
    cronLog.error({ error: configError.message }, '[Cron] Error leyendo config_recordatorios')
    return
  }

  if (!config || !config.activo) {
    cronLog.info('[Cron] Recordatorios desactivados o sin configuración')
    return
  }

  let sent = 0
  let failed = 0

  // ── Recordatorio 24h ───────────────────────────────────────────────────────
  if (config.recordatorio_24h) {
    // Ventana: citas entre 20h y 28h desde ahora
    const desde24h = new Date(now.getTime() + 20 * 60 * 60 * 1000)
    const hasta24h = new Date(now.getTime() + 28 * 60 * 60 * 1000)

    const { data: citas24h, error: err24 } = await supabase
      .from('citas')
      .select(`
        id, fecha_inicio,
        cliente:clientes(nombre, telefono),
        servicio:servicios(nombre),
        especialista:especialistas(nombre, whatsapp, notificaciones)
      `)
      .eq('estado', 'confirmada')
      .eq('recordatorio_24h_enviado', false)
      .gte('fecha_inicio', desde24h.toISOString())
      .lte('fecha_inicio', hasta24h.toISOString())

    if (err24) {
      cronLog.error({ error: err24.message }, '[Cron] Error buscando citas 24h')
    }

    for (const cita of (citas24h ?? [])) {
      const tel = (cita.cliente as { nombre?: string; telefono?: string } | null)?.telefono
      if (tel) {
        const msg = buildMensajeCliente(config, cita as Record<string, unknown>, '24h')
        const res = await sendText({ to: normalizarTelefono(tel), text: msg })
        if (res.ok) {
          sent++
          cronLog.info({ citaId: cita.id, tel }, '[Cron] 24h enviado a cliente')
        } else {
          failed++
          cronLog.error({ citaId: cita.id, error: res.errorMessage }, '[Cron] 24h FALLIDO a cliente')
        }
      }

      // Notificar especialista si corresponde
      const esp = cita.especialista as { nombre?: string; whatsapp?: string; notificaciones?: boolean } | null
      if (config.notificar_especialista && esp?.whatsapp && esp?.notificaciones) {
        await sendText({
          to: normalizarTelefono(esp.whatsapp),
          text: buildMensajeEspecialista(cita as Record<string, unknown>, '24h'),
        })
      }

      // Marcar como enviado SOLO si el envío al cliente fue exitoso (o no tenía teléfono)
      await supabase.from('citas')
        .update({ recordatorio_24h_enviado: true, fecha_recordatorio_24h: now.toISOString() })
        .eq('id', cita.id)
    }
  }

  // ── Recordatorio 2h ────────────────────────────────────────────────────────
  if (config.recordatorio_2h) {
    // Ventana: citas entre 1h y 3h desde ahora (más preciso al correr cada hora)
    const desde2h = new Date(now.getTime() + 60 * 60 * 1000)      // +1h
    const hasta2h = new Date(now.getTime() + 3 * 60 * 60 * 1000)  // +3h

    const { data: citas2h, error: err2h } = await supabase
      .from('citas')
      .select(`
        id, fecha_inicio,
        cliente:clientes(nombre, telefono),
        servicio:servicios(nombre),
        especialista:especialistas(nombre, whatsapp, notificaciones)
      `)
      .eq('estado', 'confirmada')
      .eq('recordatorio_2h_enviado', false)
      .gte('fecha_inicio', desde2h.toISOString())
      .lte('fecha_inicio', hasta2h.toISOString())

    if (err2h) {
      cronLog.error({ error: err2h.message }, '[Cron] Error buscando citas 2h')
    }

    for (const cita of (citas2h ?? [])) {
      const tel = (cita.cliente as { nombre?: string; telefono?: string } | null)?.telefono
      if (tel) {
        const msg = buildMensajeCliente(config, cita as Record<string, unknown>, '2h')
        const res = await sendText({ to: normalizarTelefono(tel), text: msg })
        if (res.ok) {
          sent++
          cronLog.info({ citaId: cita.id, tel }, '[Cron] 2h enviado a cliente')
        } else {
          failed++
          cronLog.error({ citaId: cita.id, error: res.errorMessage }, '[Cron] 2h FALLIDO a cliente')
        }
      }

      const esp = cita.especialista as { nombre?: string; whatsapp?: string; notificaciones?: boolean } | null
      if (config.notificar_especialista && esp?.whatsapp && esp?.notificaciones) {
        await sendText({
          to: normalizarTelefono(esp.whatsapp),
          text: buildMensajeEspecialista(cita as Record<string, unknown>, '2h'),
        })
      }

      await supabase.from('citas')
        .update({ recordatorio_2h_enviado: true, fecha_recordatorio_2h: now.toISOString() })
        .eq('id', cita.id)
    }
  }

  cronLog.info({ sent, failed, ts: now.toISOString() }, '[Cron] Recordatorios ejecutados')
}

// ── Inicialización ────────────────────────────────────────────────────────────

export function initCronJobs(): void {
  // Corre cada hora en punto, zona Colombia
  // Al correr cada hora, la ventana de 1h-3h captura las citas de ~2h antes
  // y la ventana de 20h-28h captura las citas de mañana
  cron.schedule('0 * * * *', async () => {
    cronLog.info('[Cron] Ejecutando recordatorios...')
    try {
      await runReminders()
    } catch (err) {
      cronLog.error({ err: (err as Error).message }, '[Cron] Error inesperado en runReminders')
    }
  }, { timezone: 'America/Bogota' })

  // Limpieza de conversaciones bot expiradas (>2h sin actividad)
  cron.schedule('0 3 * * *', async () => {
    cronLog.info('[Cron] Limpieza de conversaciones expiradas...')
    try {
      const supabase = getSupabase()
      const hace2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const { error } = await supabase
        .from('conversaciones_bot')
        .delete()
        .lt('updated_at', hace2h)
      if (error) cronLog.error({ error: error.message }, '[Cron] Error limpiando conversaciones')
      else cronLog.info('[Cron] Conversaciones expiradas limpiadas')
    } catch (err) {
      cronLog.error({ err: (err as Error).message }, '[Cron] Error en limpieza')
    }
  }, { timezone: 'America/Bogota' })

  cronLog.info('[Cron] Jobs inicializados — recordatorios cada hora')
}

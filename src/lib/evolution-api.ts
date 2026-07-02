import axios, { AxiosError } from 'axios'

const BASE_URL = process.env.EVOLUTION_API_URL
const API_KEY  = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME

// ── Resultado detallado de envío ────────────────────────────────────────────

export interface SendResult {
  ok: boolean
  statusCode?: number
  errorMessage?: string
  /** Respuesta completa de Evolution API (para logging) */
  rawResponse?: unknown
}

/**
 * Normaliza un número de teléfono al formato internacional Colombia (57XXXXXXXXXX).
 * Si ya tiene el prefijo 57 (10 dígitos tras el 57), lo deja igual.
 * Si tiene 10 dígitos (sin 57), lo agrega.
 */
export function normalizarTelefono(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('57') && digits.length === 12) return digits   // ya correcto
  if (digits.startsWith('57') && digits.length > 12)  return digits.slice(0, 12)
  if (digits.length === 10) return `57${digits}`                        // agregar prefijo
  if (digits.length === 11 && digits.startsWith('0')) return `57${digits.slice(1)}`
  return digits // devolver tal cual si no encaja (se registrará el error)
}

/**
 * Envía un mensaje de WhatsApp a través de Evolution API.
 * Retorna un objeto detallado con el resultado, nunca lanza.
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<SendResult> {
  if (!BASE_URL || !API_KEY || !INSTANCE) {
    return {
      ok: false,
      errorMessage: `Variables de entorno faltantes: ${[
        !BASE_URL && 'EVOLUTION_API_URL',
        !API_KEY  && 'EVOLUTION_API_KEY',
        !INSTANCE && 'EVOLUTION_INSTANCE_NAME',
      ].filter(Boolean).join(', ')}`,
    }
  }

  const phone = normalizarTelefono(to)

  if (phone.length < 11) {
    return {
      ok: false,
      errorMessage: `Número de teléfono inválido: "${to}" → normalizado a "${phone}" (mínimo 11 dígitos con código de país)`,
    }
  }

  try {
    const { data, status } = await axios.post(
      `${BASE_URL}/message/sendText/${INSTANCE}`,
      { number: phone, text: message },
      {
        headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    )
    return { ok: true, statusCode: status, rawResponse: data }
  } catch (err) {
    const axiosErr = err as AxiosError
    const statusCode = axiosErr.response?.status
    const rawResponse = axiosErr.response?.data

    let errorMessage = axiosErr.message
    if (rawResponse) {
      try {
        errorMessage = `HTTP ${statusCode} — ${JSON.stringify(rawResponse)}`
      } catch {
        errorMessage = `HTTP ${statusCode} — ${String(rawResponse)}`
      }
    }

    console.error('[Evolution API] Error enviando mensaje:', {
      to: phone,
      statusCode,
      errorMessage,
      rawResponse,
    })

    return { ok: false, statusCode, errorMessage, rawResponse }
  }
}

// ── Helpers de mensajes específicos ─────────────────────────────────────────

export async function sendWhatsAppReminder(
  to: string,
  serviceName: string,
  fecha: string,
  hora: string
): Promise<SendResult> {
  const message = `⏰ *Recordatorio de cita*

Servicio: *${serviceName}*
Fecha: *${fecha}*
Hora: *${hora}*

Te esperamos en *Claudia Agudelo Beauty* 💖

¿Necesitas reprogramar? Escríbenos 😊`
  return sendWhatsAppMessage(to, message)
}

export async function sendAppointmentConfirmation(
  to: string,
  data: {
    cliente: string
    servicio: string
    especialista: string
    fecha: string
    hora: string
    precio: string
  }
): Promise<SendResult> {
  const message = `✅ *Cita reservada correctamente*

👤 Cliente: *${data.cliente}*
💅 Servicio: *${data.servicio}*
👩 Especialista: *${data.especialista}*
📅 Fecha: *${data.fecha}*
⏰ Hora: *${data.hora}*
💵 Valor: *${data.precio}*

Gracias por elegir *Claudia Agudelo Beauty* 💖`
  return sendWhatsAppMessage(to, message)
}

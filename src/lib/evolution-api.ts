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

// ── Tipos para listas interactivas ──────────────────────────────────────────

export interface ListRow {
  /** Identificador único de la fila — se recibe en el webhook como rowId */
  rowId: string
  title: string
  description?: string
}

export interface ListSection {
  title: string
  rows: ListRow[]
}

export interface SendListOptions {
  /** Número destino (se normaliza automáticamente) */
  to: string
  /** Título principal del mensaje (bold, primera línea) */
  title: string
  /** Texto descriptivo bajo el título */
  description: string
  /** Texto del botón que abre la lista */
  buttonText: string
  /** Secciones con sus filas */
  sections: ListSection[]
  /** Pie de mensaje opcional */
  footer?: string
}

export interface ButtonItem {
  displayText: string
  id: string
}

export interface SendButtonsOptions {
  to: string
  title: string
  description: string
  footer?: string
  buttons: ButtonItem[]
}

export interface SendMediaOptions {
  to: string
  mediatype: 'image' | 'video' | 'document' | 'audio'
  /** URL pública accesible por Evolution API */
  media: string
  caption?: string
  fileName?: string
}

// ── Helpers internos ────────────────────────────────────────────────────────

/** Construye los headers comunes para Evolution API */
function buildHeaders() {
  return { apikey: API_KEY!, 'Content-Type': 'application/json' }
}

/** Valida que las variables de entorno estén presentes */
function checkEnvVars(): string | null {
  const missing = [
    !BASE_URL && 'EVOLUTION_API_URL',
    !API_KEY  && 'EVOLUTION_API_KEY',
    !INSTANCE && 'EVOLUTION_INSTANCE_NAME',
  ].filter(Boolean)
  return missing.length ? `Variables de entorno faltantes: ${missing.join(', ')}` : null
}

/** Convierte un AxiosError en un SendResult fallido */
function axiosErrToResult(err: unknown): SendResult {
  const axiosErr = err as AxiosError
  const statusCode  = axiosErr.response?.status
  const rawResponse = axiosErr.response?.data
  let errorMessage  = axiosErr.message
  if (rawResponse) {
    try { errorMessage = `HTTP ${statusCode} — ${JSON.stringify(rawResponse)}` }
    catch { errorMessage = `HTTP ${statusCode} — ${String(rawResponse)}` }
  }
  return { ok: false, statusCode, errorMessage, rawResponse }
}

// ── Normalización ────────────────────────────────────────────────────────────

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
  const envErr = checkEnvVars()
  if (envErr) return { ok: false, errorMessage: envErr }

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
      { headers: buildHeaders(), timeout: 10000 }
    )
    return { ok: true, statusCode: status, rawResponse: data }
  } catch (err) {
    const result = axiosErrToResult(err)
    console.error('[Evolution API] Error sendText:', {
      to: phone,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
    })
    return result
  }
}

/**
 * Envía una lista interactiva de WhatsApp (Send List).
 * Si Evolution API devuelve error, cae automáticamente a sendWhatsAppMessage() con texto.
 *
 * Límites de WhatsApp Business API:
 *   - Máximo 10 secciones
 *   - Máximo 10 filas por sección (total máximo 10 filas)
 *   - rowId: máximo 200 caracteres
 *   - title de fila: máximo 24 caracteres
 *   - description de fila: máximo 72 caracteres
 */
export async function sendWhatsAppList(options: SendListOptions): Promise<SendResult> {
  const envErr = checkEnvVars()
  if (envErr) return { ok: false, errorMessage: envErr }

  const phone = normalizarTelefono(options.to)
  if (phone.length < 11) {
    return { ok: false, errorMessage: `Número inválido: "${options.to}"` }
  }

  try {
    const { data, status } = await axios.post(
      `${BASE_URL}/message/sendList/${INSTANCE}`,
      {
        number:      phone,
        title:       options.title,
        description: options.description,
        buttonText:  options.buttonText,
        footerText:  options.footer ?? '',
        sections:    options.sections,
      },
      { headers: buildHeaders(), timeout: 10000 }
    )
    return { ok: true, statusCode: status, rawResponse: data }
  } catch (err) {
    const result = axiosErrToResult(err)
    console.error('[Evolution API] Error sendList — fallback a texto:', {
      to: phone,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
    })

    // ── Fallback automático a texto plano ──────────────────────────────────
    const fallbackLines = [`*${options.title}*`, '', options.description, '']
    for (const section of options.sections) {
      if (section.title) fallbackLines.push(`*${section.title}*`)
      for (const row of section.rows) {
        const desc = row.description ? ` — ${row.description}` : ''
        fallbackLines.push(`• ${row.title}${desc}`)
      }
      fallbackLines.push('')
    }
    if (options.footer) fallbackLines.push(`_${options.footer}_`)
    const fallbackText = fallbackLines.join('\n').trim()

    return sendWhatsAppMessage(options.to, fallbackText)
  }
}

/**
 * Envía botones de respuesta rápida (preparado para uso futuro).
 * Máximo 3 botones en WhatsApp.
 * Fallback automático a sendWhatsAppMessage() si la API falla.
 */
export async function sendWhatsAppButtons(options: SendButtonsOptions): Promise<SendResult> {
  const envErr = checkEnvVars()
  if (envErr) return { ok: false, errorMessage: envErr }

  const phone = normalizarTelefono(options.to)
  if (phone.length < 11) {
    return { ok: false, errorMessage: `Número inválido: "${options.to}"` }
  }

  // WhatsApp solo permite máximo 3 botones
  const buttons = options.buttons.slice(0, 3).map(b => ({
    type:        'reply',
    reply: { id: b.id, title: b.displayText },
  }))

  try {
    const { data, status } = await axios.post(
      `${BASE_URL}/message/sendButtons/${INSTANCE}`,
      {
        number:      phone,
        title:       options.title,
        description: options.description,
        footerText:  options.footer ?? '',
        buttons,
      },
      { headers: buildHeaders(), timeout: 10000 }
    )
    return { ok: true, statusCode: status, rawResponse: data }
  } catch (err) {
    const result = axiosErrToResult(err)
    console.error('[Evolution API] Error sendButtons — fallback a texto:', {
      to: phone,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
    })

    // Fallback a texto
    const lines = [`*${options.title}*`, '', options.description, '']
    options.buttons.forEach(b => lines.push(`• ${b.displayText}`))
    if (options.footer) lines.push('', `_${options.footer}_`)
    return sendWhatsAppMessage(options.to, lines.join('\n').trim())
  }
}

/**
 * Envía un archivo multimedia (imagen, video, audio, documento) — preparado para uso futuro.
 * Fallback a sendWhatsAppMessage() si la API falla.
 */
export async function sendWhatsAppMedia(options: SendMediaOptions): Promise<SendResult> {
  const envErr = checkEnvVars()
  if (envErr) return { ok: false, errorMessage: envErr }

  const phone = normalizarTelefono(options.to)
  if (phone.length < 11) {
    return { ok: false, errorMessage: `Número inválido: "${options.to}"` }
  }

  try {
    const { data, status } = await axios.post(
      `${BASE_URL}/message/sendMedia/${INSTANCE}`,
      {
        number:    phone,
        mediatype: options.mediatype,
        media:     options.media,
        caption:   options.caption ?? '',
        fileName:  options.fileName ?? '',
      },
      { headers: buildHeaders(), timeout: 15000 }
    )
    return { ok: true, statusCode: status, rawResponse: data }
  } catch (err) {
    const result = axiosErrToResult(err)
    console.error('[Evolution API] Error sendMedia — fallback a texto:', {
      to: phone,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
    })
    if (options.caption) {
      return sendWhatsAppMessage(options.to, options.caption)
    }
    return result
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

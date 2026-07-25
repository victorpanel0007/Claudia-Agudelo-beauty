/**
 * Capa de compatibilidad WhatsApp.
 * Antes usaba Evolution API — ahora redirige al backend de Railway (Dualhook).
 * Mantiene exactamente las mismas firmas de funcion para no romper nada.
 */

const BACKEND_URL = process.env.WHATSAPP_BACKEND_URL ?? 'https://claudia-beauty-backend-production.up.railway.app'

export interface SendResult {
  ok: boolean
  statusCode?: number
  errorMessage?: string
  rawResponse?: unknown
}

export interface ListRow { rowId: string; title: string; description?: string }
export interface ListSection { title: string; rows: ListRow[] }
export interface SendListOptions { to: string; title: string; description: string; buttonText: string; sections: ListSection[]; footer?: string }
export interface ButtonItem { displayText: string; id: string }
export interface SendButtonsOptions { to: string; title: string; description: string; footer?: string; buttons: ButtonItem[] }
export interface SendMediaOptions { to: string; mediatype: 'image' | 'video' | 'document' | 'audio'; media: string; caption?: string; fileName?: string }

export function normalizarTelefono(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('57') && digits.length === 12) return digits
  if (digits.startsWith('57') && digits.length > 12)   return digits.slice(0, 12)
  if (digits.length === 10) return `57${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `57${digits.slice(1)}`
  return digits
}

async function postToBackend(endpoint: string, body: unknown): Promise<SendResult> {
  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(10_000),
    })
    const data = await res.json() as { ok?: boolean; messageId?: string; error?: string }
    if (!res.ok) return { ok: false, statusCode: res.status, errorMessage: data?.error ?? res.statusText }
    return { ok: true, statusCode: res.status, rawResponse: data }
  } catch (err) {
    return { ok: false, errorMessage: (err as Error).message }
  }
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<SendResult> {
  return postToBackend('/api/messages/send', { to: normalizarTelefono(to), text: message })
}

export async function sendWhatsAppList(options: SendListOptions): Promise<SendResult> {
  // Fallback a texto plano — la Cloud API oficial no soporta listas interactivas de Baileys
  const lines = [`*${options.title}*`, '', options.description, '']
  for (const section of options.sections) {
    if (section.title) lines.push(`*${section.title}*`)
    for (const row of section.rows) {
      lines.push(`• ${row.title}${row.description ? ` — ${row.description}` : ''}`)
    }
    lines.push('')
  }
  if (options.footer) lines.push(`_${options.footer}_`)
  return sendWhatsAppMessage(options.to, lines.join('\n').trim())
}

export async function sendWhatsAppButtons(options: SendButtonsOptions): Promise<SendResult> {
  const lines = [`*${options.title}*`, '', options.description, '']
  options.buttons.forEach(b => lines.push(`• ${b.displayText}`))
  if (options.footer) lines.push('', `_${options.footer}_`)
  return sendWhatsAppMessage(options.to, lines.join('\n').trim())
}

export async function sendWhatsAppMedia(options: SendMediaOptions): Promise<SendResult> {
  if (options.mediatype === 'image') {
    return postToBackend('/api/messages/image', { to: normalizarTelefono(options.to), imageUrl: options.media, caption: options.caption })
  }
  if (options.mediatype === 'document') {
    return postToBackend('/api/messages/document', { to: normalizarTelefono(options.to), docUrl: options.media, caption: options.caption, filename: options.fileName })
  }
  if (options.mediatype === 'audio') {
    return postToBackend('/api/messages/audio', { to: normalizarTelefono(options.to), audioUrl: options.media })
  }
  if (options.caption) return sendWhatsAppMessage(options.to, options.caption)
  return { ok: false, errorMessage: 'Tipo de media no soportado' }
}

export async function sendWhatsAppReminder(to: string, serviceName: string, fecha: string, hora: string): Promise<SendResult> {
  const message = `⏰ *Recordatorio de cita*\n\nServicio: *${serviceName}*\nFecha: *${fecha}*\nHora: *${hora}*\n\nTe esperamos en *Claudia Agudelo Beauty* 💖\n\n¿Necesitas reprogramar? Escribenos 😊`
  return sendWhatsAppMessage(to, message)
}

export async function sendAppointmentConfirmation(to: string, data: { cliente: string; servicio: string; especialista: string; fecha: string; hora: string; precio: string }): Promise<SendResult> {
  const message = `✅ *Cita reservada correctamente*\n\n👤 Cliente: *${data.cliente}*\n💅 Servicio: *${data.servicio}*\n👩 Especialista: *${data.especialista}*\n📅 Fecha: *${data.fecha}*\n⏰ Hora: *${data.hora}*\n💵 Valor: *${data.precio}*\n\nGracias por elegir *Claudia Agudelo Beauty* 💖`
  return sendWhatsAppMessage(to, message)
}

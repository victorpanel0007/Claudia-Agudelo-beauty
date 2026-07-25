/**
 * WhatsApp Service — Meta Cloud API (Graph API)
 * Dualhook maneja los webhooks ENTRANTES.
 * Para ENVIAR mensajes se usa directamente graph.facebook.com.
 */
import axios, { AxiosError } from 'axios'
import { env } from '../config/env'
import { dualhookLog } from '../config/logger'
import type {
  SendResult, SendTextOptions, SendImageOptions,
  SendAudioOptions, SendDocumentOptions, SendLocationOptions,
} from '../types'

const GRAPH_URL = 'https://api.dualhook.com/v25.0'

function buildHeaders() {
  return {
    Authorization: `Bearer ${env.DUALHOOK_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

function getPhoneNumberId(): string {
  return env.DUALHOOK_PHONE_NUMBER_ID
}

function handleAxiosError(err: unknown, context: string): SendResult {
  const e = err as AxiosError
  const statusCode  = e.response?.status
  const rawResponse = e.response?.data
  let errorMessage  = e.message
  if (rawResponse) {
    try { errorMessage = `HTTP ${statusCode} — ${JSON.stringify(rawResponse)}` }
    catch { errorMessage = `HTTP ${statusCode}` }
  }
  dualhookLog.error({ context, statusCode, errorMessage }, '[WhatsApp] Error de envio')
  return { ok: false, statusCode, errorMessage, rawResponse }
}

// ── Enviar texto ────────────────────────────────────────────────────────────

export async function sendText(options: SendTextOptions): Promise<SendResult> {
  const phoneId = getPhoneNumberId()
  if (!phoneId || !env.DUALHOOK_API_KEY) {
    return { ok: false, errorMessage: 'DUALHOOK_API_KEY o DUALHOOK_PHONE_NUMBER_ID no configurados' }
  }
  try {
    const { data, status } = await axios.post(
      `${GRAPH_URL}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to:                options.to,
        type:              'text',
        text:              { body: options.text, preview_url: options.preview ?? false },
      },
      { headers: buildHeaders(), timeout: 10_000 }
    )
    const messageId = (data as { messages?: Array<{ id: string }> })?.messages?.[0]?.id
    dualhookLog.info({ to: options.to, messageId }, '[WhatsApp] Texto enviado')
    return { ok: true, statusCode: status, messageId, rawResponse: data }
  } catch (err) {
    return handleAxiosError(err, 'sendText')
  }
}

// ── Enviar imagen ───────────────────────────────────────────────────────────

export async function sendImage(options: SendImageOptions): Promise<SendResult> {
  const phoneId = getPhoneNumberId()
  try {
    const { data, status } = await axios.post(
      `${GRAPH_URL}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to:   options.to,
        type: 'image',
        image: { link: options.imageUrl, caption: options.caption ?? '' },
      },
      { headers: buildHeaders(), timeout: 15_000 }
    )
    const messageId = (data as { messages?: Array<{ id: string }> })?.messages?.[0]?.id
    dualhookLog.info({ to: options.to, messageId }, '[WhatsApp] Imagen enviada')
    return { ok: true, statusCode: status, messageId, rawResponse: data }
  } catch (err) {
    return handleAxiosError(err, 'sendImage')
  }
}

// ── Enviar audio ────────────────────────────────────────────────────────────

export async function sendAudio(options: SendAudioOptions): Promise<SendResult> {
  const phoneId = getPhoneNumberId()
  try {
    const { data, status } = await axios.post(
      `${GRAPH_URL}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to:    options.to,
        type:  'audio',
        audio: { link: options.audioUrl },
      },
      { headers: buildHeaders(), timeout: 15_000 }
    )
    const messageId = (data as { messages?: Array<{ id: string }> })?.messages?.[0]?.id
    dualhookLog.info({ to: options.to, messageId }, '[WhatsApp] Audio enviado')
    return { ok: true, statusCode: status, messageId, rawResponse: data }
  } catch (err) {
    return handleAxiosError(err, 'sendAudio')
  }
}

// ── Enviar documento ────────────────────────────────────────────────────────

export async function sendDocument(options: SendDocumentOptions): Promise<SendResult> {
  const phoneId = getPhoneNumberId()
  try {
    const { data, status } = await axios.post(
      `${GRAPH_URL}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to:       options.to,
        type:     'document',
        document: { link: options.docUrl, filename: options.filename ?? 'documento.pdf', caption: options.caption ?? '' },
      },
      { headers: buildHeaders(), timeout: 15_000 }
    )
    const messageId = (data as { messages?: Array<{ id: string }> })?.messages?.[0]?.id
    dualhookLog.info({ to: options.to, messageId }, '[WhatsApp] Documento enviado')
    return { ok: true, statusCode: status, messageId, rawResponse: data }
  } catch (err) {
    return handleAxiosError(err, 'sendDocument')
  }
}

// ── Enviar ubicacion ────────────────────────────────────────────────────────

export async function sendLocation(options: SendLocationOptions): Promise<SendResult> {
  const phoneId = getPhoneNumberId()
  try {
    const { data, status } = await axios.post(
      `${GRAPH_URL}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to:       options.to,
        type:     'location',
        location: { latitude: options.lat, longitude: options.lng, name: options.name ?? '', address: options.address ?? '' },
      },
      { headers: buildHeaders(), timeout: 10_000 }
    )
    const messageId = (data as { messages?: Array<{ id: string }> })?.messages?.[0]?.id
    dualhookLog.info({ to: options.to, messageId }, '[WhatsApp] Ubicacion enviada')
    return { ok: true, statusCode: status, messageId, rawResponse: data }
  } catch (err) {
    return handleAxiosError(err, 'sendLocation')
  }
}

// ── Marcar como leido ───────────────────────────────────────────────────────

export async function markAsRead(messageId: string): Promise<void> {
  const phoneId = getPhoneNumberId()
  if (!phoneId || !env.DUALHOOK_API_KEY) return
  try {
    await axios.post(
      `${GRAPH_URL}/${phoneId}/messages`,
      { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
      { headers: buildHeaders(), timeout: 5_000 }
    )
    dualhookLog.debug({ messageId }, '[WhatsApp] Mensaje marcado como leido')
  } catch {
    // no critico
  }
}

export async function typingOn(_to: string): Promise<void> { /* no soportado en Cloud API */ }
export async function typingOff(_to: string): Promise<void> { /* no soportado en Cloud API */ }

export function normalizarTelefono(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('57') && digits.length === 12) return digits
  if (digits.startsWith('57') && digits.length > 12)   return digits.slice(0, 12)
  if (digits.length === 10) return `57${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `57${digits.slice(1)}`
  return digits
}

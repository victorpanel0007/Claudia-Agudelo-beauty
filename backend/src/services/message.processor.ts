/**
 * Procesador de mensajes entrantes de WhatsApp via Dualhook.
 * Delega toda la logica del bot a bot.engine.ts.
 */
import { getSupabase } from '../database/supabase'
import { webhookLog } from '../config/logger'
import { sendText, markAsRead } from './whatsapp.service'
import { transcribeFromUrl } from './openai.service'
import { processBotMessage } from './bot.engine'
import type { DualhookMessage, DualhookStatus } from '../types'

const PAUSA_MINUTOS = 20

async function isBotPausado(telefono: string): Promise<boolean> {
  const sb = getSupabase()
  const { data } = await sb.from('bot_pausas').select('pausado_hasta').eq('telefono', telefono).maybeSingle()
  if (!data) return false
  if (new Date(data.pausado_hasta as string) > new Date()) return true
  await sb.from('bot_pausas').delete().eq('telefono', telefono)
  return false
}

async function logMessage(telefono: string, mensaje: string, tipo: 'entrante' | 'saliente' | 'sistema'): Promise<void> {
  try {
    await getSupabase().from('mensajes_whatsapp').insert({ telefono, mensaje, tipo, fecha: new Date().toISOString() })
  } catch { /* no bloquear */ }
}

export async function processIncomingMessage(msg: DualhookMessage, _contactName: string): Promise<void> {
  const telefono = msg.from
  webhookLog.info({
    telefono,
    type:      msg.type,
    msgId:     msg.id,
    timestamp: msg.timestamp,
    textBody:  msg.text?.body ?? null,
  }, '[Processor] 📥 Iniciando procesamiento de mensaje entrante')

  // Marcar como leido
  markAsRead(msg.id).catch(e =>
    webhookLog.warn({ err: (e as Error).message }, '[Processor] No se pudo marcar como leido')
  )

  // Verificar pausa (cuando admin responde manualmente)
  webhookLog.debug({ telefono }, '[Processor] Verificando si bot está pausado...')
  const pausado = await isBotPausado(telefono)
  if (pausado) {
    const text = msg.text?.body ?? ''
    if (text) await logMessage(telefono, text, 'entrante')
    webhookLog.info({ telefono }, '[Processor] Bot PAUSADO — mensaje registrado pero ignorado por el bot')
    return
  }
  webhookLog.debug({ telefono }, '[Processor] Bot activo — procesando mensaje')

  switch (msg.type) {
    case 'text': {
      const text = msg.text?.body?.trim() ?? ''
      if (!text) {
        webhookLog.warn({ telefono, msgId: msg.id }, '[Processor] Mensaje de texto vacío — ignorando')
        return
      }
      webhookLog.info({ telefono, text }, '[Processor] 💬 Texto recibido — enviando al bot engine')
      await processBotMessage(telefono, text)
      webhookLog.info({ telefono }, '[Processor] ✅ Bot engine procesó el mensaje')
      break
    }
    case 'audio': {
      webhookLog.info({ telefono, audioId: msg.audio?.id }, '[Processor] 🎤 Audio recibido')
      await logMessage(telefono, '[Audio entrante]', 'entrante')
      await handleAudioMessage(telefono, msg)
      break
    }
    case 'interactive': {
      const reply = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? ''
      webhookLog.info({ telefono, reply }, '[Processor] 🖱️ Interactivo recibido')
      if (reply) await processBotMessage(telefono, reply)
      break
    }
    default:
      webhookLog.debug({ type: msg.type, telefono }, '[Processor] Tipo de mensaje no manejado — ignorando')
  }
}

async function handleAudioMessage(telefono: string, msg: DualhookMessage): Promise<void> {
  const ack = '🎤 Estoy escuchando tu mensaje...\nUn momento por favor 😊'
  sendText({ to: telefono, text: ack }).catch(() => {})
  await logMessage(telefono, ack, 'saliente')

  if (!msg.audio?.id) {
    await sendText({ to: telefono, text: 'No pude procesar el audio. Intenta nuevamente.' })
    return
  }

  const audioUrl = `https://graph.facebook.com/v20.0/${msg.audio.id}`
  const result = await transcribeFromUrl(audioUrl)

  if (!result.ok) {
    const errMsg = result.errorCode === 'too_large'
      ? 'El audio es muy largo 😊 Por favor envialo en partes mas cortas.'
      : 'No pude entender el audio. Intenta escribir tu mensaje.'
    await sendText({ to: telefono, text: errMsg })
    await logMessage(telefono, errMsg, 'saliente')
    return
  }

  webhookLog.info({ telefono, text: result.text?.slice(0, 60) }, '[Bot] Audio transcrito')
  await processBotMessage(telefono, result.text!)
}

export async function processStatusUpdate(status: DualhookStatus): Promise<void> {
  webhookLog.debug({ id: status.id, status: status.status }, '[Webhook] Status update')
  if (status.status === 'failed' && status.errors?.length) {
    webhookLog.error({ recipient: status.recipient_id, errors: status.errors }, '[Dualhook] Mensaje fallido')
  }
}

// Pausar bot cuando admin responde manualmente (llamado desde webhook controller)
export async function pausarBot(telefono: string): Promise<void> {
  const pausado_hasta = new Date(Date.now() + PAUSA_MINUTOS * 60 * 1000).toISOString()
  await getSupabase().from('bot_pausas').upsert(
    { telefono, pausado_hasta, pausado_por: 'admin_whatsapp' },
    { onConflict: 'telefono' }
  )
}

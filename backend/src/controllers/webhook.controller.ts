import { Request, Response } from 'express'
import { env } from '../config/env'
import { webhookLog } from '../config/logger'
import { validateWebhookSignature } from '../utils/validate-webhook'
import { isDuplicate } from '../utils/dedup'
import { processIncomingMessage, processStatusUpdate, pausarBot } from '../services/message.processor'
import type { DualhookWebhookBody, DualhookMessage } from '../types'

// ── GET — Verificacion del webhook (Meta handshake) ─────────────────────────

export function verifyWebhook(req: Request, res: Response): void {
  const mode      = req.query['hub.mode']      as string
  const token     = req.query['hub.verify_token'] as string
  const challenge = req.query['hub.challenge'] as string

  webhookLog.info({ mode, token: token?.slice(0, 8) + '...', challenge }, '[Webhook] Intento de verificacion')

  if (mode === 'subscribe' && token === env.DUALHOOK_VERIFY_TOKEN) {
    webhookLog.info('[Webhook] ✅ Verificacion exitosa')
    res.status(200).send(challenge)
    return
  }
  webhookLog.warn({ mode, tokenRecibido: token, tokenEsperado: env.DUALHOOK_VERIFY_TOKEN?.slice(0, 8) + '...' }, '[Webhook] ❌ Verificacion fallida — token no coincide')
  res.status(403).json({ error: 'Verificacion fallida' })
}

// ── POST — Mensajes entrantes ────────────────────────────────────────────────

export function receiveWebhook(req: Request, res: Response): void {
  // Responder 200 inmediatamente — procesar en segundo plano
  res.status(200).json({ status: 'ok' })

  // LOG COMPLETO del payload recibido (para diagnóstico)
  webhookLog.info({
    headers: {
      'content-type': req.headers['content-type'],
      'x-hub-signature-256': req.headers['x-hub-signature-256'] ? '✅ presente' : '❌ ausente',
      'user-agent': req.headers['user-agent'],
    },
    body: req.body,
  }, '[Webhook] 📥 Payload COMPLETO recibido de DualHook')

  // Validar firma solo si el secret esta configurado y no es el valor por defecto
  const secret    = env.DUALHOOK_WEBHOOK_SECRET
  const signature = req.headers['x-hub-signature-256'] as string ?? ''
  // IMPORTANTE: usar rawBody si está disponible (configurado en app.ts), o re-serializar
  const rawBody   = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

  if (secret && secret !== 'changeme' && signature) {
    if (!validateWebhookSignature(rawBody, signature, secret)) {
      webhookLog.warn('[Webhook] ❌ Firma invalida — payload ignorado')
      return
    }
    webhookLog.debug('[Webhook] ✅ Firma valida')
  } else {
    webhookLog.info({
      secret: secret === 'changeme' ? 'usando valor por defecto' : 'configurado',
      signature: signature ? 'presente' : 'ausente',
    }, '[Webhook] Validacion de firma omitida — procesando payload directamente')
  }

  const body = req.body as DualhookWebhookBody

  // Verificar si es el formato Meta Cloud API (object = 'whatsapp_business_account')
  if (body.object !== 'whatsapp_business_account') {
    webhookLog.warn({
      objectRecibido: body.object,
      bodyCompleto: body,
    }, '[Webhook] ⚠️  body.object NO es "whatsapp_business_account" — verificar formato que envía DualHook')

    // Intentar extraer mensajes de formatos alternativos (DualHook puede variar)
    tryProcessAlternativeFormat(body as unknown as Record<string, unknown>)
    return
  }

  webhookLog.info({ object: body.object, numEntries: body.entry?.length ?? 0 }, '[Webhook] ✅ Formato Meta Cloud API reconocido')

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value

      webhookLog.info({
        field: change.field,
        numMessages: value.messages?.length ?? 0,
        numStatuses: value.statuses?.length ?? 0,
        numContacts: value.contacts?.length ?? 0,
        phoneNumberId: value.metadata?.phone_number_id,
      }, '[Webhook] Procesando change')

      // Mensajes entrantes
      for (const msg of value.messages ?? []) {
        webhookLog.info({
          from:    msg.from,
          msgId:   msg.id,
          type:    msg.type,
          body:    msg.text?.body ?? '[no texto]',
          timestamp: msg.timestamp,
          context: msg.context ?? null,
          phoneNumberId: value.metadata?.phone_number_id,
        }, '[Webhook] 📨 Mensaje detectado')

        // ── Detectar si este mensaje es del humano (admin/operador) ──────────
        // Dualhook envía los mensajes salientes del negocio como webhooks.
        // El remitente del mensaje coincide con el número/ID del propio negocio.
        const displayPhone    = value.metadata?.display_phone_number?.replace(/\D/g, '') ?? ''
        const phoneNumberId   = value.metadata?.phone_number_id ?? ''
        const fromDigits      = msg.from.replace(/\D/g, '')

        const esMensajeDelNegocio =
          (displayPhone && (fromDigits === displayPhone || fromDigits === displayPhone.replace(/^57/, ''))) ||
          (phoneNumberId && (msg.from === phoneNumberId || fromDigits === phoneNumberId.replace(/\D/g, ''))) ||
          msg.type === 'system'

        if (esMensajeDelNegocio) {
          webhookLog.info({
            from: msg.from, displayPhone, phoneNumberId, context: msg.context,
          }, '[Webhook] 📤 Mensaje saliente del negocio detectado')

          // Si el contexto tiene el número del cliente destinatario, pausar el bot para ese cliente.
          // Cuando el admin responde manualmente desde WhatsApp Business,
          // el campo context.from contiene el número del cliente al que respondió.
          const clienteTelefono = msg.context?.from?.replace(/\D/g, '') ?? ''
          if (clienteTelefono && clienteTelefono !== fromDigits) {
            webhookLog.info({
              clienteTelefono, adminTelefono: msg.from,
            }, '[Webhook] 🙋 Admin respondió manualmente — pausando bot para el cliente')
            pausarBot(clienteTelefono).catch(err =>
              webhookLog.error({ err: (err as Error).message }, '[Webhook] Error al pausar bot')
            )
          } else {
            webhookLog.info('[Webhook] Mensaje saliente sin contexto de cliente — no se puede pausar automáticamente')
          }
          continue
        }

        // ── Mensaje de un cliente ────────────────────────────────────────────
        if (isDuplicate(msg.id)) {
          webhookLog.debug({ msgId: msg.id }, '[Webhook] Mensaje duplicado ignorado')
          continue
        }

        const contactName = value.contacts?.find(c => c.wa_id === msg.from)?.profile?.name ?? ''
        webhookLog.info({ from: msg.from, contactName, type: msg.type }, '[Webhook] 🚀 Enviando a processIncomingMessage')

        // Procesar en background — nunca bloquear la respuesta 200
        processIncomingMessage(msg, contactName)
          .then(() => webhookLog.info({ from: msg.from, msgId: msg.id }, '[Webhook] ✅ Mensaje procesado correctamente'))
          .catch(err => webhookLog.error({
            err:   (err as Error).message,
            stack: (err as Error).stack,
            from:  msg.from,
            msgId: msg.id,
          }, '[Webhook] ❌ Error procesando mensaje'))
      }

      // Estados (sent, delivered, read, failed)
      for (const status of value.statuses ?? []) {
        processStatusUpdate(status).catch(err =>
          webhookLog.error({ err: (err as Error).message }, '[Webhook] Error procesando status')
        )
      }
    }
  }
}

// ── Soporte para formatos alternativos de DualHook ──────────────────────────
// DualHook puede enviar el payload en un formato ligeramente diferente.
// Esta función intenta extraer mensajes de estructuras conocidas.

function tryProcessAlternativeFormat(body: Record<string, unknown>): void {
  webhookLog.info({ body }, '[Webhook] Intentando parsear formato alternativo de DualHook')

  // Formato alternativo 1: body directo con messages array
  const messages = body['messages'] as DualhookMessage[] | undefined
  if (Array.isArray(messages)) {
    webhookLog.info({ count: messages.length }, '[Webhook] Formato alternativo 1: messages array directo')
    for (const msg of messages) {
      if (!msg.from || !msg.id) continue
      if (isDuplicate(msg.id)) continue
      processIncomingMessage(msg, '')
        .then(() => webhookLog.info({ from: msg.from }, '[Webhook] ✅ Alt-format mensaje procesado'))
        .catch(err => webhookLog.error({ err: (err as Error).message, stack: (err as Error).stack }, '[Webhook] ❌ Alt-format error'))
    }
    return
  }

  // Formato alternativo 2: { data: { messages: [...] } }
  const data = body['data'] as Record<string, unknown> | undefined
  if (data) {
    const dataMsgs = data['messages'] as DualhookMessage[] | undefined
    if (Array.isArray(dataMsgs)) {
      webhookLog.info({ count: dataMsgs.length }, '[Webhook] Formato alternativo 2: data.messages')
      for (const msg of dataMsgs) {
        if (!msg.from || !msg.id) continue
        if (isDuplicate(msg.id)) continue
        processIncomingMessage(msg, '')
          .then(() => webhookLog.info({ from: msg.from }, '[Webhook] ✅ Alt-format2 mensaje procesado'))
          .catch(err => webhookLog.error({ err: (err as Error).message, stack: (err as Error).stack }, '[Webhook] ❌ Alt-format2 error'))
      }
      return
    }
  }

  webhookLog.warn({ body }, '[Webhook] ⚠️  No se reconoció ningún formato conocido. Revisar documentación de DualHook.')
}

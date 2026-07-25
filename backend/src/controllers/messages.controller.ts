import { Request, Response } from 'express'
import { z } from 'zod'
import { sendText, sendImage, sendAudio, sendDocument, sendLocation, normalizarTelefono } from '../services/whatsapp.service'
import { getSupabase } from '../database/supabase'
import { dualhookLog } from '../config/logger'

const phoneSchema   = z.string().min(8).max(15)
const messageSchema = z.object({ to: phoneSchema, text: z.string().min(1).max(4096) })
const imageSchema   = z.object({ to: phoneSchema, imageUrl: z.string().url(), caption: z.string().optional() })
const audioSchema   = z.object({ to: phoneSchema, audioUrl: z.string().url() })
const documentSchema = z.object({ to: phoneSchema, docUrl: z.string().url(), filename: z.string().optional(), caption: z.string().optional() })
const locationSchema = z.object({ to: phoneSchema, lat: z.number(), lng: z.number(), name: z.string().optional(), address: z.string().optional() })

async function logOutgoing(telefono: string, mensaje: string): Promise<void> {
  try {
    await getSupabase().from('mensajes_whatsapp').insert({
      telefono, mensaje, tipo: 'saliente', fecha: new Date().toISOString(),
    })
  } catch { /* no bloquear */ }
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const parsed = messageSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  const { to, text } = parsed.data
  const phone = normalizarTelefono(to)
  const result = await sendText({ to: phone, text })
  if (!result.ok) { res.status(500).json({ error: result.errorMessage }); return }
  await logOutgoing(phone, text)
  dualhookLog.info({ to: phone, messageId: result.messageId }, '[API] Texto enviado')
  res.json({ ok: true, messageId: result.messageId })
}

export async function sendImageMessage(req: Request, res: Response): Promise<void> {
  const parsed = imageSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  const phone  = normalizarTelefono(parsed.data.to)
  const result = await sendImage({ ...parsed.data, to: phone })
  if (!result.ok) { res.status(500).json({ error: result.errorMessage }); return }
  await logOutgoing(phone, `[Imagen] ${parsed.data.imageUrl}`)
  res.json({ ok: true, messageId: result.messageId })
}

export async function sendAudioMessage(req: Request, res: Response): Promise<void> {
  const parsed = audioSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  const phone  = normalizarTelefono(parsed.data.to)
  const result = await sendAudio({ ...parsed.data, to: phone })
  if (!result.ok) { res.status(500).json({ error: result.errorMessage }); return }
  await logOutgoing(phone, `[Audio] ${parsed.data.audioUrl}`)
  res.json({ ok: true, messageId: result.messageId })
}

export async function sendDocumentMessage(req: Request, res: Response): Promise<void> {
  const parsed = documentSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  const phone  = normalizarTelefono(parsed.data.to)
  const result = await sendDocument({ ...parsed.data, to: phone })
  if (!result.ok) { res.status(500).json({ error: result.errorMessage }); return }
  await logOutgoing(phone, `[Documento] ${parsed.data.filename ?? parsed.data.docUrl}`)
  res.json({ ok: true, messageId: result.messageId })
}

export async function sendLocationMessage(req: Request, res: Response): Promise<void> {
  const parsed = locationSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  const phone  = normalizarTelefono(parsed.data.to)
  const result = await sendLocation({ ...parsed.data, to: phone })
  if (!result.ok) { res.status(500).json({ error: result.errorMessage }); return }
  await logOutgoing(phone, `[Ubicacion] lat=${parsed.data.lat} lng=${parsed.data.lng}`)
  res.json({ ok: true, messageId: result.messageId })
}

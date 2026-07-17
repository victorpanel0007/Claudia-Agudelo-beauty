import { NextRequest, NextResponse } from 'next/server'
import { processMessage } from '../webhook/route'

/**
 * POST — Mensajes entrantes desde Twilio WhatsApp Sandbox/Producción
 *
 * Twilio envía form-urlencoded con:
 *   From: "whatsapp:+573026021232"
 *   Body: "hola"
 *   MessageSid: "SMxxxxxxx"
 *
 * Reutiliza exactamente la misma lógica del bot que Evolution API.
 * Solo cambia el canal de envío (controlado por WHATSAPP_PROVIDER=twilio en Vercel).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    // Normalizar número: "whatsapp:+573026021232" → "573026021232"
    const fromRaw = String(formData.get('From') ?? '')
    const from    = fromRaw.replace('whatsapp:+', '').replace('whatsapp:', '').replace('+', '')

    const body    = String(formData.get('Body') ?? '').trim()
    const msgType = String(formData.get('MediaContentType0') ?? '')
    const isAudio = msgType.startsWith('audio/')

    if (!from) return new NextResponse('', { status: 200 })

    console.info(`[Twilio Webhook] De: ${from} | Tipo: ${isAudio ? 'audio' : 'texto'} | Mensaje: ${body.slice(0, 80)}`)

    if (!body && !isAudio) return new NextResponse('', { status: 200 })

    // Procesar con el mismo motor del bot
    await processMessage(from, body)

    // Twilio requiere respuesta 200 con TwiML vacío
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    )
  } catch (e) {
    console.error('[Twilio Webhook] Error:', e)
    return new NextResponse('', { status: 500 })
  }
}

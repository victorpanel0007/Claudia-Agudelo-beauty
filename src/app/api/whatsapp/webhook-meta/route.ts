import { NextRequest, NextResponse } from 'next/server'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'claudia-beauty-meta-2026'

/**
 * GET — Verificación del webhook por Meta
 * Meta llama a esta URL con hub.challenge para verificar que el endpoint es válido
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.info('[Meta Webhook] Verificación exitosa')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[Meta Webhook] Token de verificación incorrecto')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/**
 * POST — Mensajes entrantes desde Meta WhatsApp API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.info('[Meta Webhook] Payload recibido:', JSON.stringify(body).slice(0, 200))

    // Confirmar recepción inmediatamente (requerido por Meta)
    // El procesamiento se hace después
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value) return NextResponse.json({ ok: true })

    // Mensajes entrantes
    const messages = value.messages ?? []
    for (const msg of messages) {
      const from = msg.from // número del cliente ej: "573001234567"
      const text = msg.text?.body ?? ''
      const type = msg.type // 'text', 'audio', 'image', etc.

      console.info(`[Meta] De: ${from} | Tipo: ${type} | Texto: ${text.slice(0, 80)}`)

      // TODO: procesar mensaje y responder
      // Por ahora solo loguea — la integración completa se configura después
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[Meta Webhook] Error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

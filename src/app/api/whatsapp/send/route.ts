import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/evolution-api'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { telefono, mensaje } = await request.json()

    if (!telefono || !mensaje) {
      return NextResponse.json(
        { error: 'telefono y mensaje son requeridos' },
        { status: 400 }
      )
    }

    const result = await sendWhatsAppMessage(telefono, mensaje)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.errorMessage || 'No se pudo enviar el mensaje. Verifica la conexión con Evolution API.' },
        { status: 500 }
      )
    }

    // Log the outgoing message
    const supabase = await createAdminClient()
    await supabase.from('mensajes_whatsapp').insert({
      telefono,
      mensaje,
      tipo: 'saliente',
      fecha: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Send error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

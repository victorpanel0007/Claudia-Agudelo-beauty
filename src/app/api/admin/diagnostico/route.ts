import { NextResponse } from 'next/server'

export async function GET() {
  const backendUrl = process.env.WHATSAPP_BACKEND_URL ?? 'https://claudia-beauty-backend-production.up.railway.app'
  const openAiKey  = process.env.OPENAI_API_KEY ?? 'NO CONFIGURADA'
  const keyMask = (k: string) => k !== 'NO CONFIGURADA' ? k.slice(0, 6) + '...' + k.slice(-4) : 'NO CONFIGURADA'

  // Probar backend Railway
  let backendStatus = 'no probado'
  let backendError  = ''
  try {
    const res  = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(5000) })
    const data = await res.json() as { ok?: boolean; supabase?: string }
    backendStatus = res.ok && data?.ok ? 'connected' : 'error'
  } catch (e) {
    backendError  = (e as Error).message
    backendStatus = 'ERROR'
  }

  // Probar OpenAI
  let openAiStatus = 'no probado'
  if (openAiKey !== 'NO CONFIGURADA') {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${openAiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      openAiStatus = res.ok ? 'OK' : `HTTP ${res.status}`
    } catch (e) {
      openAiStatus = `ERROR: ${(e as Error).message}`
    }
  } else {
    openAiStatus = 'CLAVE NO CONFIGURADA'
  }

  return NextResponse.json({
    WHATSAPP_PROVIDER:  'dualhook',
    WHATSAPP_BACKEND:   backendUrl,
    backend_estado:     backendStatus,
    backend_error:      backendError || null,
    OPENAI_API_KEY:     keyMask(openAiKey),
    openai_estado:      openAiStatus,
  })
}

import { NextResponse } from 'next/server'

export async function GET() {
  const evoUrl  = process.env.EVOLUTION_API_URL ?? 'NO CONFIGURADA'
  const evoKey  = process.env.EVOLUTION_API_KEY  ?? 'NO CONFIGURADA'
  const evoInst = process.env.EVOLUTION_INSTANCE_NAME ?? 'NO CONFIGURADA'
  const openAiKey = process.env.OPENAI_API_KEY ?? 'NO CONFIGURADA'
  const provider = process.env.WHATSAPP_PROVIDER ?? 'evolution (default)'

  const keyMask = (k: string) => k !== 'NO CONFIGURADA' ? k.slice(0,6)+'...'+k.slice(-4) : 'NO CONFIGURADA'

  // Probar conexión Evolution API
  let evoStatus = 'no probado'
  let evoError  = ''
  try {
    const res = await fetch(`${evoUrl}/instance/connectionState/${evoInst}`, {
      headers: { apikey: evoKey },
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    evoStatus = data?.instance?.state ?? JSON.stringify(data)
  } catch (e) {
    evoError = (e as Error).message
    evoStatus = 'ERROR'
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
    WHATSAPP_PROVIDER:       provider,
    EVOLUTION_API_URL:       evoUrl,
    EVOLUTION_API_KEY:       keyMask(evoKey),
    EVOLUTION_INSTANCE_NAME: evoInst,
    evolution_estado:        evoStatus,
    evolution_error:         evoError || null,
    OPENAI_API_KEY:          keyMask(openAiKey),
    openai_estado:           openAiStatus,
  })
}

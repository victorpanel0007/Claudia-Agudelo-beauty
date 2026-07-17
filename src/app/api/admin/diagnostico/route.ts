import { NextResponse } from 'next/server'

export async function GET() {
  const evoUrl  = process.env.EVOLUTION_API_URL ?? 'NO CONFIGURADA'
  const evoKey  = process.env.EVOLUTION_API_KEY  ?? 'NO CONFIGURADA'
  const evoInst = process.env.EVOLUTION_INSTANCE_NAME ?? 'NO CONFIGURADA'

  // Enmascarar la key por seguridad
  const keyMask = evoKey !== 'NO CONFIGURADA'
    ? evoKey.slice(0, 6) + '...' + evoKey.slice(-4)
    : 'NO CONFIGURADA'

  // Probar conexión con Evolution API
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

  return NextResponse.json({
    EVOLUTION_API_URL:       evoUrl,
    EVOLUTION_API_KEY:       keyMask,
    EVOLUTION_INSTANCE_NAME: evoInst,
    conexion_estado:         evoStatus,
    conexion_error:          evoError || null,
  })
}

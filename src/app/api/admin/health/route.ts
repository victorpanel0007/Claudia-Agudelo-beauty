import { NextResponse } from 'next/server'

/**
 * Health check del backend WhatsApp (Railway + Dualhook).
 */
export async function GET() {
  const backendUrl = process.env.WHATSAPP_BACKEND_URL ?? 'https://claudia-beauty-backend-production.up.railway.app'

  try {
    const res = await fetch(`${backendUrl}/health`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json() as { ok?: boolean; supabase?: string }
    const connected = res.ok && data?.ok === true
    return NextResponse.json({
      ok:        connected,
      provider:  'dualhook',
      backend:   backendUrl,
      supabase:  data?.supabase ?? 'unknown',
      timestamp: new Date().toISOString(),
      hora_colombia: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    }, {
      status: connected ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return NextResponse.json({
      ok: false, error: (e as Error).message, timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}

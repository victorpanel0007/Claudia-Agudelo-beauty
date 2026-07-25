import { NextResponse } from 'next/server'

/**
 * Estado de conexion WhatsApp.
 * Consulta el backend de Railway (Dualhook) en lugar de Evolution API.
 */
export async function GET() {
  const backendUrl = process.env.WHATSAPP_BACKEND_URL ?? 'https://claudia-beauty-backend-production.up.railway.app'

  try {
    const res = await fetch(`${backendUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json() as { ok?: boolean; supabase?: string }
    const connected = res.ok && data?.ok === true
    return NextResponse.json({
      connected,
      provider: 'dualhook',
      backend:  backendUrl,
      supabase: data?.supabase ?? 'unknown',
    })
  } catch {
    return NextResponse.json({ connected: false, reason: 'Backend Railway no disponible' })
  }
}

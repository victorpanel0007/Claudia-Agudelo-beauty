import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/rbac'

/**
 * POST /api/admin/test-reminders
 * Ejecuta el cron de recordatorios manualmente desde el panel admin.
 * Solo accesible para administradores.
 */
export async function POST() {
  const rol = await getUserRole()
  if (rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  }

  // Llamar al cron internamente con el secret del servidor
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const secret  = process.env.CRON_SECRET

  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/reminders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[test-reminders]', err)
    return NextResponse.json({ error: 'Error al ejecutar el cron' }, { status: 500 })
  }
}

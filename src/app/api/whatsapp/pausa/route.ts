/**
 * API de control de pausas del bot por conversación.
 * GET  ?telefono=57xxx  → estado actual de la pausa
 * POST { telefono, accion: 'pausar'|'reanudar', minutos? } → cambiar estado
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserRole, forbidden } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  const rol = await getUserRole()
  if (!rol) return forbidden('No autorizado')

  const supabase = await createAdminClient()
  const telefono = request.nextUrl.searchParams.get('telefono')

  if (telefono) {
    const { data } = await supabase
      .from('bot_pausas')
      .select('*')
      .eq('telefono', telefono)
      .maybeSingle()

    const ahora = new Date()
    const activo = data && new Date(data.pausado_hasta) > ahora
    return NextResponse.json({
      telefono,
      pausado: activo,
      pausado_hasta: activo ? data.pausado_hasta : null,
      minutos_restantes: activo
        ? Math.ceil((new Date(data.pausado_hasta).getTime() - ahora.getTime()) / 60000)
        : 0,
    })
  }

  // Listar todas las pausas activas
  const { data } = await supabase
    .from('bot_pausas')
    .select('*')
    .gt('pausado_hasta', new Date().toISOString())

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const rol = await getUserRole()
  if (!rol) return forbidden('No autorizado')

  const supabase = await createAdminClient()
  const { telefono, accion, minutos = 20 } = await request.json()

  if (!telefono || !accion) {
    return NextResponse.json({ error: 'telefono y accion son requeridos' }, { status: 400 })
  }

  if (accion === 'pausar') {
    const pausado_hasta = new Date(Date.now() + minutos * 60 * 1000).toISOString()
    await supabase.from('bot_pausas').upsert(
      { telefono, pausado_hasta, pausado_por: 'admin' },
      { onConflict: 'telefono' }
    )
    return NextResponse.json({ ok: true, pausado: true, pausado_hasta, minutos })
  }

  if (accion === 'reanudar') {
    await supabase.from('bot_pausas').delete().eq('telefono', telefono)
    return NextResponse.json({ ok: true, pausado: false })
  }

  return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { notificarEspecialista } from '@/lib/notificaciones'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createAdminClient()
  const { id } = await params
  const body = await request.json()

  const { data, error } = await supabase
    .from('citas')
    .update(body)
    .eq('id', id)
    .select(`
      *,
      cliente:clientes(id, nombre, telefono),
      especialista:especialistas(id, nombre, whatsapp, notificaciones),
      servicio:servicios(id, nombre, duracion_minutos)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si la cita pasa a confirmada, notificar especialista
  if (body.estado === 'confirmada' && data.especialista_id) {
    notificarEspecialista(data as Parameters<typeof notificarEspecialista>[0], supabase)
      .catch(e => console.error('[Notif] Error:', e))
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createAdminClient()
  const { id } = await params
  const { error } = await supabase.from('citas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

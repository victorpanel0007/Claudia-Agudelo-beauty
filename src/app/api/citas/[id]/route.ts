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

  // Si la cita se está completando con valor_final, calcular comisión automáticamente
  let updateData = { ...body }
  if (body.estado === 'completada' && body.valor_final) {
    // Obtener la cita actual para saber el especialista
    const { data: citaActual } = await supabase
      .from('citas')
      .select('especialista_id')
      .eq('id', id)
      .single()

    if (citaActual?.especialista_id) {
      // Obtener porcentaje de comisión vigente
      const { data: comConfig } = await supabase
        .from('comisiones_config')
        .select('porcentaje')
        .eq('especialista_id', citaActual.especialista_id)
        .maybeSingle()

      const porcentaje = comConfig?.porcentaje ?? 40
      const valor = Number(body.valor_final)
      const comision = Math.round(valor * (porcentaje / 100))
      const ganancia = valor - comision

      updateData = {
        ...updateData,
        porcentaje_comision: porcentaje,
        comision_especialista: comision,
        ganancia_spa: ganancia,
      }
    }
  }

  const { data: rows, error } = await supabase
    .from('citas')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      cliente:clientes(id, nombre, telefono),
      especialista:especialistas(id, nombre, whatsapp, notificaciones),
      servicio:servicios(id, nombre, duracion_minutos)
    `)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows || rows.length === 0) return NextResponse.json({ error: 'Cita no encontrada o RLS bloqueó la actualización' }, { status: 404 })

  const data = rows[0]

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

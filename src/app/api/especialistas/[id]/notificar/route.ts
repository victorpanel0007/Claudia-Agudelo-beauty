import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage, normalizarTelefono } from '@/lib/evolution-api'
import { getUserRole, forbidden } from '@/lib/rbac'

/**
 * POST /api/especialistas/[id]/notificar
 * Envía un mensaje de prueba a la especialista especificada.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rol = await getUserRole()
  if (rol !== 'admin') return forbidden('Solo administradores')

  const { id } = await params
  const supabase = await createAdminClient()

  const { data: esp, error } = await supabase
    .from('especialistas')
    .select('id, nombre, whatsapp')
    .eq('id', id)
    .single()

  if (error || !esp) {
    return NextResponse.json({ error: 'Especialista no encontrada' }, { status: 404 })
  }

  if (!esp.whatsapp || esp.whatsapp.trim() === '') {
    return NextResponse.json(
      { ok: false, error: 'Esta especialista no tiene número de WhatsApp configurado.' },
      { status: 400 }
    )
  }

  const telefono = normalizarTelefono(esp.whatsapp)
  const mensaje  = `🔔 *Mensaje de prueba — Claudia Agudelo Beauty*

Hola ${esp.nombre} 👋
Este es un mensaje de prueba para verificar que las notificaciones de nuevas citas llegan correctamente a tu WhatsApp.

✅ Si ves este mensaje, ¡todo funciona perfectamente!`

  const result = await sendWhatsAppMessage(telefono, mensaje)

  // Registrar en historial
  await supabase.from('notificaciones_especialista').insert({
    cita_id:             null,
    especialista_id:     esp.id,
    especialista_nombre: esp.nombre,
    whatsapp_destino:    telefono,
    mensaje,
    estado:              result.ok ? 'enviado' : 'error',
    tipo:                'prueba',
    codigo_respuesta:    result.ok ? (result.statusCode ?? 200) : (result.statusCode ?? null),
    error_detalle:       result.ok ? null : (result.errorMessage ?? 'Error desconocido'),
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.errorMessage, statusCode: result.statusCode },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, telefono })
}

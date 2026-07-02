/**
 * Servicio de Notificaciones a Especialistas
 * Envía mensajes de WhatsApp automáticamente cuando una cita es confirmada.
 * Nunca bloquea el proceso principal — todos los errores son capturados.
 */

import { sendWhatsAppMessage } from './evolution-api'
import { formatDate, formatTime, formatCurrency } from './utils'

const ORIGEN_LABELS: Record<string, string> = {
  web:    '🌐 Sitio Web',
  whatsapp: '🤖 WhatsApp IA',
  admin:  '🖥️ Panel Administrativo',
  telefono: '📞 Teléfono',
}

export interface CitaParaNotificar {
  id: string
  fecha_inicio: string
  fecha_fin: string
  canal?: string
  observaciones?: string
  valor_final?: number | null
  cliente?: { nombre?: string; telefono?: string }
  servicio?: { nombre?: string; duracion_minutos?: number }
  especialista?: {
    id?: string
    nombre?: string
    whatsapp?: string
    notificaciones?: boolean
  }
}

function buildMessage(cita: CitaParaNotificar, espNombre: string): string {
  const cliente  = cita.cliente?.nombre || 'Sin nombre'
  // NO incluir teléfono ni datos de contacto del cliente
  const servicio = cita.servicio?.nombre || 'Sin servicio'
  const duracion = cita.servicio?.duracion_minutos ? `${cita.servicio.duracion_minutos} min` : 'No definida'
  const fecha    = formatDate(cita.fecha_inicio)
  const hora     = formatTime(cita.fecha_inicio)
  const origen   = ORIGEN_LABELS[cita.canal || 'web'] || '🌐 Sitio Web'
  const notas    = cita.observaciones || 'Sin observaciones'
  const idCorto  = cita.id.slice(0, 8).toUpperCase()

  return `📅 *Nueva cita confirmada*

Hola ${espNombre} 👋
Tienes una nueva cita confirmada.

━━━━━━━━━━━━━━━
👩 Cliente:
${cliente}

💅 Servicio:
${servicio}

📅 Fecha:
${fecha}

🕒 Hora:
${hora}

⏳ Duración:
${duracion}

📝 Observaciones:
${notas}

🌐 Origen:
${origen}
━━━━━━━━━━━━━━━
ID de la cita:
#${idCorto}`
}

/**
 * Envía notificación a la especialista de forma asíncrona.
 * Guarda el resultado en el historial de notificaciones.
 * Nunca lanza excepciones — siempre retorna silenciosamente.
 */
export async function notificarEspecialista(
  cita: CitaParaNotificar,
  supabase: ReturnType<typeof import('./supabase/server').createAdminClient> extends Promise<infer T> ? T : never
): Promise<void> {
  try {
    const esp = cita.especialista
    if (!esp?.id || !esp?.whatsapp) return
    if (esp.notificaciones === false) return

    const telefono = esp.whatsapp.replace(/\D/g, '')
    if (!telefono || telefono.length < 10) return

    const espNombre = esp.nombre || 'Especialista'
    const mensaje = buildMessage(cita, espNombre)

    // Registrar intento en historial
    const { data: notif } = await supabase
      .from('notificaciones_especialista')
      .insert({
        cita_id: cita.id,
        especialista_id: esp.id,
        especialista_nombre: espNombre,
        whatsapp_destino: telefono,
        mensaje,
        estado: 'pendiente',
        tipo: 'confirmacion',
      })
      .select('id')
      .single()

    // Enviar mensaje (no awaited para no bloquear)
    const enviado = await sendWhatsAppMessage(telefono, mensaje)

    // Actualizar estado en historial
    if (notif?.id) {
      await supabase
        .from('notificaciones_especialista')
        .update({
          estado: enviado ? 'enviado' : 'error',
          codigo_respuesta: enviado ? 200 : 500,
          error_detalle: enviado ? null : 'Evolution API no pudo enviar el mensaje',
        })
        .eq('id', notif.id)
    }
  } catch (err) {
    // Nunca bloquear el flujo principal
    console.error('[Notificaciones] Error al notificar especialista:', err)
  }
}

/**
 * Reenvía una notificación fallida por su ID.
 */
export async function reenviarNotificacion(
  notifId: string,
  supabase: ReturnType<typeof import('./supabase/server').createAdminClient> extends Promise<infer T> ? T : never
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('notificaciones_especialista')
      .select('*')
      .eq('id', notifId)
      .single()

    if (!data) return false

    const enviado = await sendWhatsAppMessage(data.whatsapp_destino, data.mensaje)

    await supabase
      .from('notificaciones_especialista')
      .update({
        estado: enviado ? 'enviado' : 'error',
        codigo_respuesta: enviado ? 200 : 500,
        error_detalle: enviado ? null : 'Reenvío fallido',
        created_at: new Date().toISOString(),
      })
      .eq('id', notifId)

    return enviado
  } catch {
    return false
  }
}

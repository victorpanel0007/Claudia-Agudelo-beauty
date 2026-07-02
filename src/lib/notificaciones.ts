/**
 * Servicio de Notificaciones a Especialistas
 * Envía mensajes de WhatsApp automáticamente cuando una cita es confirmada.
 * Nunca bloquea el proceso principal — todos los errores son capturados y registrados.
 */

import { sendWhatsAppMessage, normalizarTelefono } from './evolution-api'
import { formatDate, formatTime } from './utils'

const ORIGEN_LABELS: Record<string, string> = {
  web:      '🌐 Sitio Web',
  whatsapp: '🤖 WhatsApp IA',
  admin:    '🖥️ Panel Administrativo',
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

type SupabaseAdminClient = Awaited<ReturnType<typeof import('./supabase/server').createAdminClient>>

/** Guarda un registro de error en el historial sin lanzar excepciones */
async function registrarError(
  supabase: SupabaseAdminClient,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('notificaciones_especialista').insert(payload)
  } catch (e) {
    console.error('[Notif] Error guardando registro de fallo:', e)
  }
}

/**
 * Envía notificación a la especialista de forma asíncrona.
 * Guarda el resultado completo (incluyendo errores detallados) en el historial.
 * Nunca lanza excepciones.
 */
export async function notificarEspecialista(
  cita: CitaParaNotificar,
  supabase: SupabaseAdminClient
): Promise<void> {
  try {
    const esp = cita.especialista

    // ── Validaciones previas ──────────────────────────────────────────────
    if (!esp?.id) {
      console.warn('[Notif] Cita sin especialista asignada — no se envía notificación', { citaId: cita.id })
      return
    }

    if (!esp.whatsapp || esp.whatsapp.trim() === '') {
      console.warn('[Notif] Especialista sin número WhatsApp configurado', {
        citaId: cita.id, especialistaId: esp.id, nombre: esp.nombre,
      })
      await registrarError(supabase, {
        cita_id:             cita.id,
        especialista_id:     esp.id,
        especialista_nombre: esp.nombre || 'Desconocida',
        whatsapp_destino:    '',
        mensaje:             buildMessage(cita, esp.nombre || 'Especialista'),
        estado:              'error',
        tipo:                'confirmacion',
        codigo_respuesta:    null,
        error_detalle:       'Especialista no tiene número de WhatsApp configurado. Ve a Especialistas → Editar → WhatsApp.',
      })
      return
    }

    if (esp.notificaciones === false) {
      console.log('[Notif] Notificaciones desactivadas para:', esp.nombre)
      return
    }

    const telefono = normalizarTelefono(esp.whatsapp)
    if (telefono.length < 11) {
      const errorMsg = `Número inválido: "${esp.whatsapp}" → normalizado a "${telefono}". Debe tener formato 573XXXXXXXXX.`
      console.error('[Notif]', errorMsg, { citaId: cita.id, especialistaId: esp.id })
      await registrarError(supabase, {
        cita_id:             cita.id,
        especialista_id:     esp.id,
        especialista_nombre: esp.nombre || 'Desconocida',
        whatsapp_destino:    telefono,
        mensaje:             buildMessage(cita, esp.nombre || 'Especialista'),
        estado:              'error',
        tipo:                'confirmacion',
        codigo_respuesta:    null,
        error_detalle:       errorMsg,
      })
      return
    }

    const espNombre = esp.nombre || 'Especialista'
    const mensaje   = buildMessage(cita, espNombre)

    // ── Registrar intento ─────────────────────────────────────────────────
    let notifId: string | null = null
    try {
      const { data: notif, error: insertError } = await supabase
        .from('notificaciones_especialista')
        .insert({
          cita_id:             cita.id,
          especialista_id:     esp.id,
          especialista_nombre: espNombre,
          whatsapp_destino:    telefono,
          mensaje,
          estado:              'pendiente',
          tipo:                'confirmacion',
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('[Notif] Error al registrar intento de notificación:', insertError)
      } else {
        notifId = notif?.id ?? null
      }
    } catch (e) {
      console.error('[Notif] Excepción al registrar intento:', e)
    }

    // ── Enviar mensaje ────────────────────────────────────────────────────
    const result = await sendWhatsAppMessage(telefono, mensaje)

    // ── Actualizar historial con resultado ────────────────────────────────
    if (notifId) {
      try {
        const { error: updateError } = await supabase
          .from('notificaciones_especialista')
          .update(
            result.ok
              ? {
                  estado:           'enviado',
                  codigo_respuesta: result.statusCode ?? 200,
                  error_detalle:    null,
                }
              : {
                  estado:           'error',
                  codigo_respuesta: result.statusCode ?? null,
                  error_detalle:    result.errorMessage ?? 'Error desconocido al enviar',
                }
          )
          .eq('id', notifId)

        if (updateError) {
          console.error('[Notif] Error actualizando estado de notificación:', updateError)
        }
      } catch (e) {
        console.error('[Notif] Excepción al actualizar estado:', e)
      }
    }

    if (!result.ok) {
      console.error('[Notif] Fallo al enviar WhatsApp a especialista', {
        citaId:       cita.id,
        especialista: esp.nombre,
        telefono,
        error:        result.errorMessage,
        statusCode:   result.statusCode,
      })
    } else {
      console.log('[Notif] Notificación enviada correctamente a', esp.nombre, telefono)
    }

  } catch (err) {
    // Captura de último recurso — nunca bloquear el flujo principal
    console.error('[Notificaciones] Error inesperado al notificar especialista:', err)
  }
}

/**
 * Reenvía una notificación fallida por su ID.
 */
export async function reenviarNotificacion(
  notifId: string,
  supabase: SupabaseAdminClient
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('notificaciones_especialista')
      .select('*')
      .eq('id', notifId)
      .single()

    if (error || !data) {
      console.error('[Notif] Notificación no encontrada para reenvío:', notifId)
      return false
    }

    if (!data.whatsapp_destino || data.whatsapp_destino.trim() === '') {
      await supabase
        .from('notificaciones_especialista')
        .update({
          estado:           'error',
          error_detalle:    'No se puede reenviar: número de WhatsApp vacío.',
          codigo_respuesta: null,
          created_at:       new Date().toISOString(),
        })
        .eq('id', notifId)
      return false
    }

    const result = await sendWhatsAppMessage(data.whatsapp_destino, data.mensaje)

    await supabase
      .from('notificaciones_especialista')
      .update({
        estado:           result.ok ? 'enviado' : 'error',
        codigo_respuesta: result.ok ? (result.statusCode ?? 200) : (result.statusCode ?? null),
        error_detalle:    result.ok ? null : (result.errorMessage ?? 'Reenvío fallido'),
        created_at:       new Date().toISOString(),
      })
      .eq('id', notifId)

    return result.ok
  } catch (err) {
    console.error('[Notif] Error en reenvío:', err)
    return false
  }
}

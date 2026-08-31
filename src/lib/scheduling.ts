import { createAdminClient } from './supabase/server'
import { addMinutes } from './utils'

export interface AvailableSlot {
  hora: string
  especialista_id: string
  especialista_nombre: string
  fecha_inicio: string
  fecha_fin: string
}

/**
 * Genera los slots disponibles para una fecha y duración dadas.
 *
 * REGLA FUNDAMENTAL:
 *   Un slot es válido si y solo si:
 *     - current >= workStart
 *     - current + duracion <= workEnd   ← el servicio completo debe terminar ANTES del cierre
 *     - No choca con ninguna cita existente
 *
 * Esto garantiza que un servicio de 60 min con cierre a las 19:00
 * ofrezca como último slot las 18:00 (termina exactamente a las 19:00),
 * nunca las 19:00 (terminaría a las 20:00).
 */
export async function getAvailableSlots(
  fecha: Date,
  duracionMinutos: number,
  especialistaId?: string
): Promise<AvailableSlot[]> {
  const supabase = await createAdminClient()

  // ── Obtener especialistas activos ───────────────────────────────────────
  let query = supabase.from('especialistas').select('*').eq('activo', true)
  if (especialistaId) {
    query = query.eq('id', especialistaId)
  }
  const { data: especialistas } = await query
  if (!especialistas?.length) return []

  // ── Obtener la fecha del día en Colombia ────────────────────────────────
  const fechaStr = fecha.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) // YYYY-MM-DD

  // ── Obtener citas del día (solo confirmadas o en proceso) ───────────────
  const dayStart = new Date(`${fechaStr}T00:00:00-05:00`)
  const dayEnd   = new Date(`${fechaStr}T23:59:59-05:00`)

  const { data: citas } = await supabase
    .from('citas')
    .select('especialista_id, fecha_inicio, fecha_fin')
    .gte('fecha_inicio', dayStart.toISOString())
    .lte('fecha_inicio', dayEnd.toISOString())
    .in('estado', ['confirmada', 'en_proceso'])

  // ── Obtener descansos de todas las especialistas ─────────────────────────
  const { data: descansos } = await supabase
    .from('descansos_especialista')
    .select('especialista_id, hora_inicio, hora_fin')

  const slots: AvailableSlot[] = []

  for (const esp of especialistas) {
    // ── Horario del especialista (fallback 09:00–19:00) ─────────────────
    const [startH, startM] = (esp.horario_inicio || '09:00').split(':').map(Number)
    const [endH, endM]     = (esp.horario_fin    || '19:00').split(':').map(Number)

    // ── Verificar día laboral en Colombia ────────────────────────────────
    // Usamos T12 para evitar que la conversión de zona cambie el día
    const dayOfWeek     = new Date(`${fechaStr}T12:00:00-05:00`).getDay()
    const diasLaborales: number[] = esp.dias_laborales || [1, 2, 3, 4, 5, 6]
    if (!diasLaborales.includes(dayOfWeek)) continue

    // ── Construir límites del día laboral ────────────────────────────────
    const workStart = new Date(
      `${fechaStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00-05:00`
    )
    const workEnd = new Date(
      `${fechaStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00-05:00`
    )

    // ── Si el día es HOY en Colombia, el slot debe ser en el futuro ───────
    // Nunca ofrecer horarios que ya pasaron
    const ahoraCol = new Date() // hora real del servidor
    const esHoy = fechaStr === ahoraCol.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    const inicioEfectivo = esHoy && ahoraCol > workStart ? ahoraCol : workStart

    // ── Construir intervalos ocupados para esta especialista ────────────
    const occupied = (citas || [])
      .filter(c => c.especialista_id === esp.id)
      .map(c => ({
        inicio: new Date(c.fecha_inicio),
        fin:    new Date(c.fecha_fin),
      }))

    // ── Agregar descansos como intervalos bloqueados ─────────────────────
    // Los descansos tienen hora_inicio / hora_fin en formato HH:MM o HH:MM:SS
    const descansosEsp = (descansos || [])
      .filter(d => d.especialista_id === esp.id)
      .map(d => {
        const hi = (d.hora_inicio as string).slice(0, 5) // HH:MM
        const hf = (d.hora_fin   as string).slice(0, 5)
        return {
          inicio: new Date(`${fechaStr}T${hi}:00-05:00`),
          fin:    new Date(`${fechaStr}T${hf}:00-05:00`),
        }
      })

    const allBlocked = [...occupied, ...descansosEsp]

    // ── Generar slots ────────────────────────────────────────────────────
    //
    // Paso del slot configurable — actualmente 30 min.
    // La condición de corte es:  slotEnd <= workEnd
    //   → el servicio debe TERMINAR dentro o exactamente al cierre.
    //   → NUNCA se ofrece un slot que haga que la cita pase del horario.
    //
    const paso = 30 // minutos entre slots — podría venir de config en el futuro

    // Calcular el primer slot: si es hoy, empezar desde el próximo slot
    // futuro redondeado hacia arriba al siguiente múltiplo de 30 min
    let current = new Date(workStart)
    if (esHoy && inicioEfectivo > workStart) {
      // Redondear hacia ARRIBA al próximo múltiplo de 30 min
      const base = new Date(inicioEfectivo)
      const mins = base.getMinutes()
      const secs = base.getSeconds()
      // Si ya está exactamente en :00 o :30 y no han pasado segundos, usar ese slot
      // Si hay segundos extra o está entre múltiplos, ir al siguiente
      if (secs > 0 || (mins !== 0 && mins !== 30)) {
        const nextMultiple = Math.ceil((mins + (secs > 0 ? 1 : 0)) / 30) * 30
        base.setMinutes(nextMultiple, 0, 0)
      }
      current = base > workStart ? base : workStart
    }

    while (true) {
      const slotEnd = addMinutes(current, duracionMinutos)

      // ✅ Condición de corte: el servicio debe terminar al cierre o antes
      if (slotEnd.getTime() > workEnd.getTime()) break

      // ✅ Verificar que no choca con ninguna cita ni descanso
      const isOccupied = allBlocked.some(
        occ => current < occ.fin && slotEnd > occ.inicio
      )

      if (!isOccupied) {
        // Formato limpio sin puntos ni espacios extra: "9:00 AM", "1:30 PM"
        const colStr = current.toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Bogota',
        })

        slots.push({
          hora:                colStr,
          especialista_id:     esp.id,
          especialista_nombre: esp.nombre,
          fecha_inicio:        current.toISOString(),
          fecha_fin:           slotEnd.toISOString(),
        })
      }

      // Avanzar al siguiente slot
      current = addMinutes(current, paso)
    }
  }

  // Ordenar por hora de inicio
  return slots.sort((a, b) =>
    new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime()
  )
}

export async function createAppointment(data: {
  cliente_id: string
  especialista_id: string
  servicio_id: string
  fecha_inicio: string
  fecha_fin: string
  valor_final?: number
  observaciones?: string
}): Promise<{ id: string } | null> {
  const supabase = await createAdminClient()

  // Verificar conflictos antes de insertar
  const { data: conflict } = await supabase
    .from('citas')
    .select('id')
    .eq('especialista_id', data.especialista_id)
    .in('estado', ['confirmada', 'en_proceso'])
    .or(
      `and(fecha_inicio.lt.${data.fecha_fin},fecha_fin.gt.${data.fecha_inicio})`
    )
    .limit(1)

  if (conflict && conflict.length > 0) {
    return null
  }

  const { data: cita, error } = await supabase
    .from('citas')
    .insert({ ...data, estado: 'confirmada' })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating appointment:', error)
    return null
  }

  return cita
}

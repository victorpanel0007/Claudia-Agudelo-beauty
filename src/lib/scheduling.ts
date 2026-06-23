import { createAdminClient } from './supabase/server'
import { addMinutes, parseTimeToDate } from './utils'

export interface AvailableSlot {
  hora: string
  especialista_id: string
  especialista_nombre: string
  fecha_inicio: string
  fecha_fin: string
}

export async function getAvailableSlots(
  fecha: Date,
  duracionMinutos: number,
  especialistaId?: string
): Promise<AvailableSlot[]> {
  const supabase = await createAdminClient()

  // Get specialists
  let query = supabase.from('especialistas').select('*').eq('activo', true)
  if (especialistaId) {
    query = query.eq('id', especialistaId)
  }
  const { data: especialistas } = await query

  if (!especialistas?.length) return []

  // Get all appointments for the given date
  const dayStart = new Date(fecha)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(fecha)
  dayEnd.setHours(23, 59, 59, 999)

  const { data: citas } = await supabase
    .from('citas')
    .select('especialista_id, fecha_inicio, fecha_fin')
    .gte('fecha_inicio', dayStart.toISOString())
    .lte('fecha_inicio', dayEnd.toISOString())
    .in('estado', ['confirmada', 'en_proceso'])

  const slots: AvailableSlot[] = []

  for (const esp of especialistas) {
    const [startH, startM] = (esp.horario_inicio || '09:00').split(':').map(Number)
    const [endH, endM] = (esp.horario_fin || '19:00').split(':').map(Number)

    const dayOfWeek = fecha.getDay()
    const diasLaborales: number[] = esp.dias_laborales || [1, 2, 3, 4, 5, 6]
    if (!diasLaborales.includes(dayOfWeek)) continue

    // Build occupied intervals for this specialist
    const occupied = (citas || [])
      .filter(c => c.especialista_id === esp.id)
      .map(c => ({
        inicio: new Date(c.fecha_inicio),
        fin: new Date(c.fecha_fin),
      }))

    // Generate 30-min slots — a slot can START up to horario_fin
    // (the service may finish after closing time, that's fine)
    let current = new Date(fecha)
    current.setHours(startH, startM, 0, 0)
    const workEnd = new Date(fecha)
    workEnd.setHours(endH, endM, 0, 0)

    while (current.getTime() <= workEnd.getTime()) {
      const slotEnd = addMinutes(current, duracionMinutos)
      const isOccupied = occupied.some(
        occ => current < occ.fin && slotEnd > occ.inicio
      )

      if (!isOccupied) {
        const h = current.getHours()
        const m = current.getMinutes().toString().padStart(2, '0')
        const ampm = h >= 12 ? 'PM' : 'AM'
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
        const horaFormateada = `${h12}:${m} ${ampm}`

        slots.push({
          hora: horaFormateada,
          especialista_id: esp.id,
          especialista_nombre: esp.nombre,
          fecha_inicio: current.toISOString(),
          fecha_fin: slotEnd.toISOString(),
        })
      }

      current = addMinutes(current, 30)
    }
  }

  // Sort by time
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

  // Check for conflicts
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
    .insert({
      ...data,
      estado: 'confirmada',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating appointment:', error)
    return null
  }

  return cita
}

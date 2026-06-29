import { createAdminClient } from './supabase/server'
import { addMinutes } from './utils'

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

  // Obtener citas del día en Colombia
  const fechaStr2 = fecha.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const dayStart = new Date(`${fechaStr2}T00:00:00-05:00`)
  const dayEnd   = new Date(`${fechaStr2}T23:59:59-05:00`)

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

    // Verificar día laboral en zona horaria Colombia
    const fechaColombia = new Date(fecha.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const dayOfWeek = fechaColombia.getDay()
    const diasLaborales: number[] = esp.dias_laborales || [1, 2, 3, 4, 5, 6]
    if (!diasLaborales.includes(dayOfWeek)) continue

    // Construir fecha inicio/fin en Colombia usando UTC offset -5
    const offsetMs = 5 * 60 * 60 * 1000 // UTC-5

    // Obtener fecha en Colombia como YYYY-MM-DD
    const fechaStr = fecha.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) // YYYY-MM-DD

    // Crear fecha inicio y fin del día en Colombia (como UTC)
    const slotStart = new Date(`${fechaStr}T${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}:00-05:00`)
    const workEnd   = new Date(`${fechaStr}T${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00-05:00`)

    // Build occupied intervals for this specialist
    const occupied = (citas || [])
      .filter(c => c.especialista_id === esp.id)
      .map(c => ({
        inicio: new Date(c.fecha_inicio),
        fin: new Date(c.fecha_fin),
      }))

    // Generar slots cada 30 minutos en hora Colombia
    let current = new Date(slotStart)

    while (current.getTime() <= workEnd.getTime()) {
      const slotEnd = addMinutes(current, duracionMinutos)
      const isOccupied = occupied.some(
        occ => current < occ.fin && slotEnd > occ.inicio
      )

      if (!isOccupied) {
        // Mostrar hora en Colombia
        const horaFormateada = current.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Bogota',
        })

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

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage, sendAppointmentConfirmation } from '@/lib/evolution-api'
import { buildWhatsAppMenu, buildCategoryMenu, CATEGORIAS, SERVICIOS_DATA } from '@/lib/services-data'
import { getAvailableSlots, createAppointment, type AvailableSlot } from '@/lib/scheduling'
import { parseFlexibleDate } from '@/lib/date-parser'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { ConversationState } from '@/types/database'

// In-memory stores (per process — fine for single-instance dev/prod)
const conversations = new Map<string, ConversationState>()
const slotsCache = new Map<string, AvailableSlot[]>()  // telefono -> available slots

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const event = body.event
    if (event !== 'messages.upsert') {
      return NextResponse.json({ ok: true })
    }

    const message = body.data?.message
    const from = body.data?.key?.remoteJid?.replace('@s.whatsapp.net', '')
    const isFromMe = body.data?.key?.fromMe

    if (!from || isFromMe || !message) {
      return NextResponse.json({ ok: true })
    }

    const text = (
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      ''
    ).trim()

    if (!text) return NextResponse.json({ ok: true })

    await processMessage(from, text)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function processMessage(telefono: string, text: string) {
  const supabase = await createAdminClient()
  let state = conversations.get(telefono)

  // Log incoming message
  await supabase.from('mensajes_whatsapp').insert({
    telefono,
    mensaje: text,
    tipo: 'entrante',
    fecha: new Date().toISOString(),
  })

  const lowerText = text.toLowerCase().trim()

  // Reset keywords
  const resetWords = ['hola', 'inicio', 'menu', 'menú', 'hi', 'hello', '0', 'cancelar', 'reiniciar']
  if (resetWords.includes(lowerText)) {
    conversations.delete(telefono)
    slotsCache.delete(telefono)
    state = undefined
  }

  if (!state) {
    await reply(telefono, buildWhatsAppMenu(), supabase)
    conversations.set(telefono, {
      telefono,
      paso: 'seleccion_categoria',
      created_at: new Date().toISOString(),
    })
    return
  }

  switch (state.paso) {
    case 'seleccion_categoria':
      await handleCategorySelection(telefono, text, state, supabase)
      break
    case 'seleccion_servicio':
      await handleServiceSelection(telefono, text, state, supabase)
      break
    case 'solicitar_nombre':
      await handleNombreInput(telefono, text, state, supabase)
      break
    case 'solicitar_fecha':
      await handleFechaInput(telefono, text, state, supabase)
      break
    case 'seleccion_especialista':
      await handleEspecialistaSelection(telefono, text, state, supabase)
      break
    case 'seleccion_horario':
      await handleHorarioSelection(telefono, text, state, supabase)
      break
    default:
      await reply(telefono, buildWhatsAppMenu(), supabase)
      conversations.set(telefono, {
        telefono,
        paso: 'seleccion_categoria',
        created_at: new Date().toISOString(),
      })
  }
}

async function handleCategorySelection(
  telefono: string,
  text: string,
  state: ConversationState,
  supabase: Awaited<ReturnType<typeof createAdminClient>>
) {
  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > CATEGORIAS.length) {
    await reply(telefono, `❌ Opción no válida. Por favor escribe un número del 1 al ${CATEGORIAS.length}.`, supabase)
    return
  }
  const cat = CATEGORIAS[num - 1]
  state.categoria_id = cat.id
  state.paso = 'seleccion_servicio'
  conversations.set(telefono, state)
  await reply(telefono, buildCategoryMenu(cat.id), supabase)
}

async function handleServiceSelection(
  telefono: string,
  text: string,
  state: ConversationState,
  supabase: Awaited<ReturnType<typeof createAdminClient>>
) {
  const servicios = SERVICIOS_DATA.filter(s => s.cat === state.categoria_id)
  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > servicios.length) {
    await reply(telefono, `❌ Opción no válida. Por favor escribe un número del 1 al ${servicios.length}.`, supabase)
    return
  }
  const servicio = servicios[num - 1]
  state.servicio_nombre = servicio.nombre
  state.duracion = servicio.duracion

  if (servicio.tipo === 'fijo' && servicio.precio) {
    state.precio = formatCurrency(servicio.precio)
  } else if (servicio.tipo === 'desde' && servicio.precio_desde) {
    state.precio = `Desde ${formatCurrency(servicio.precio_desde)}`
  } else {
    state.precio = 'Requiere valoración'
  }

  state.paso = 'solicitar_nombre'
  conversations.set(telefono, state)

  let priceMsg = ''
  if (servicio.tipo === 'valoracion' || servicio.requiere_valoracion) {
    priceMsg = `\n\nℹ️ El precio final dependerá de:\n• Largo del cabello\n• Cantidad de cabello\n• Técnica utilizada\n• Productos necesarios`
  } else {
    priceMsg = `\n\n💵 Precio: *${state.precio}*\n⏱️ Duración: *${servicio.duracion} minutos*`
  }

  await reply(
    telefono,
    `💅 *${servicio.nombre}*${priceMsg}\n\n✍️ Por favor escribe tu *nombre completo*:`,
    supabase
  )
}

async function handleNombreInput(
  telefono: string,
  text: string,
  state: ConversationState,
  supabase: Awaited<ReturnType<typeof createAdminClient>>
) {
  if (text.length < 3) {
    await reply(telefono, '❌ Por favor escribe tu nombre completo (mínimo 3 caracteres).', supabase)
    return
  }
  state.nombre = text
  state.paso = 'solicitar_fecha'
  conversations.set(telefono, state)
  await reply(
    telefono,
    `👋 Hola *${text}*!\n\n📅 ¿Qué fecha prefieres para tu cita?\n\nPuedes escribir de cualquier forma:\n• *mañana*\n• *próximo sábado*\n• *15/06/2026*\n• *15 de junio*\n• *dentro de 3 días*`,
    supabase
  )
}

async function handleFechaInput(
  telefono: string,
  text: string,
  state: ConversationState,
  supabase: Awaited<ReturnType<typeof createAdminClient>>
) {
  const parsed = parseFlexibleDate(text)

  if (!parsed.fecha || parsed.error) {
    await reply(
      telefono,
      parsed.error || `❌ No pude entender la fecha.\n\nPuedes escribir:\n• *mañana*\n• *próximo lunes*\n• *15/06/2026*\n• *15 de junio*\n• *dentro de 3 días*`,
      supabase
    )
    return
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (parsed.fecha < today) {
    await reply(
      telefono,
      `❌ La fecha *${parsed.display}* ya pasó.\n\nElige una fecha futura. Ejemplos:\n• *mañana*\n• *próximo sábado*\n• *20/07/2026*`,
      supabase
    )
    return
  }

  state.fecha = parsed.fecha.toISOString()
  state.paso = 'seleccion_especialista'
  conversations.set(telefono, state)

  await reply(
    telefono,
    `📅 Fecha confirmada: *${parsed.interpreted}* ✅\n\n👩 ¿Qué especialista prefieres?\n\n1️⃣ Claudia\n2️⃣ Andrea\n3️⃣ Cualquiera disponible`,
    supabase
  )
}

async function handleEspecialistaSelection(
  telefono: string,
  text: string,
  state: ConversationState,
  supabase: Awaited<ReturnType<typeof createAdminClient>>
) {
  const { data: especialistas } = await supabase
    .from('especialistas')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > 3) {
    await reply(telefono, '❌ Por favor escribe 1, 2 o 3.', supabase)
    return
  }

  let especialistaId: string | undefined
  if (num === 1 && especialistas?.[0]) {
    especialistaId = especialistas[0].id
    state.especialista_id = especialistaId
  } else if (num === 2 && especialistas?.[1]) {
    especialistaId = especialistas[1].id
    state.especialista_id = especialistaId
  }
  // num === 3 → any available, especialistaId stays undefined

  await reply(telefono, `🔍 Buscando horarios disponibles...`, supabase)

  const fecha = new Date(state.fecha!)
  const slots = await getAvailableSlots(fecha, state.duracion || 60, especialistaId)

  if (!slots.length) {
    const nombre = num === 1 ? 'Claudia' : num === 2 ? 'Andrea' : 'ninguna especialista'
    await reply(
      telefono,
      `😔 No hay disponibilidad para *${formatDate(fecha)}* con *${nombre}*.\n\nPor favor elige otra fecha:\n• *mañana*\n• *próximo lunes*\n• *20/07/2026*`,
      supabase
    )
    state.paso = 'solicitar_fecha'
    conversations.set(telefono, state)
    return
  }

  // Store slots in separate cache (not in conversation state)
  const shown = slots.slice(0, 8)
  slotsCache.set(telefono, shown)

  state.paso = 'seleccion_horario'
  conversations.set(telefono, state)

  const slotsList = shown
    .map((s, i) => `${i + 1}️⃣ *${s.hora}* — ${s.especialista_nombre}`)
    .join('\n')

  let extraMsg = ''
  if (slots.length > 8) {
    const lastSlot = slots[slots.length - 1]
    extraMsg = `\n\n_Mostrando 8 de ${slots.length} horarios disponibles (hasta las ${lastSlot.hora})._\n_Si ninguno te funciona, escribe otra fecha._`
  }

  await reply(
    telefono,
    `🕐 *Horarios disponibles* para *${formatDate(fecha)}*:\n\n${slotsList}${extraMsg}\n\n✍️ Escribe el número del horario que prefieres:`,
    supabase
  )
}

async function handleHorarioSelection(
  telefono: string,
  text: string,
  state: ConversationState,
  supabase: Awaited<ReturnType<typeof createAdminClient>>
) {
  const slots = slotsCache.get(telefono) || []
  const num = parseInt(text)

  if (isNaN(num) || num < 1 || num > slots.length) {
    await reply(telefono, `❌ Por favor escribe un número del 1 al ${slots.length}.`, supabase)
    return
  }

  const selectedSlot = slots[num - 1]

  // Get or create client
  let clienteId: string | undefined
  const { data: existingClient } = await supabase
    .from('clientes')
    .select('id')
    .eq('telefono', telefono)
    .single()

  if (existingClient) {
    clienteId = existingClient.id
  } else {
    const { data: newClient } = await supabase
      .from('clientes')
      .insert({
        nombre: state.nombre,
        telefono,
        fecha_registro: new Date().toISOString(),
      })
      .select('id')
      .single()
    clienteId = newClient?.id
  }

  if (!clienteId) {
    await reply(telefono, '❌ Hubo un error al procesar tu reserva. Por favor escribe *hola* para intentar de nuevo.', supabase)
    return
  }

  // Find service ID in DB
  const { data: servicio } = await supabase
    .from('servicios')
    .select('id')
    .eq('nombre', state.servicio_nombre)
    .single()

  if (!servicio) {
    await reply(telefono, '❌ Servicio no encontrado. Por favor escribe *hola* para intentar de nuevo.', supabase)
    conversations.delete(telefono)
    slotsCache.delete(telefono)
    return
  }

  const cita = await createAppointment({
    cliente_id: clienteId,
    especialista_id: selectedSlot.especialista_id,
    servicio_id: servicio.id,
    fecha_inicio: selectedSlot.fecha_inicio,
    fecha_fin: selectedSlot.fecha_fin,
  })

  if (!cita) {
    await reply(
      telefono,
      '❌ Lo sentimos, ese horario ya fue reservado. Por favor escribe *hola* para elegir otro horario.',
      supabase
    )
    conversations.delete(telefono)
    slotsCache.delete(telefono)
    return
  }

  // Clean up state
  conversations.delete(telefono)
  slotsCache.delete(telefono)

  const fecha = new Date(selectedSlot.fecha_inicio)
  await sendAppointmentConfirmation(telefono, {
    cliente: state.nombre!,
    servicio: state.servicio_nombre!,
    especialista: selectedSlot.especialista_nombre,
    fecha: formatDate(fecha),
    hora: selectedSlot.hora,
    precio: state.precio || 'A definir en la cita',
  })

  // Log confirmation to DB
  await supabase.from('mensajes_whatsapp').insert({
    cliente_id: clienteId,
    telefono,
    mensaje: `✅ Cita confirmada: ${state.servicio_nombre} con ${selectedSlot.especialista_nombre} el ${formatDate(fecha)} a las ${selectedSlot.hora}`,
    tipo: 'sistema',
    fecha: new Date().toISOString(),
  })
}

// Helper: send + log outgoing message
async function reply(
  telefono: string,
  message: string,
  supabase: Awaited<ReturnType<typeof createAdminClient>>
) {
  // Fire and forget — don't let send failure break the conversation flow
  sendWhatsAppMessage(telefono, message).catch(e =>
    console.error(`[WhatsApp send failed to ${telefono}]:`, e?.message)
  )
  // Log regardless of send result
  try {
    await supabase.from('mensajes_whatsapp').insert({
      telefono,
      mensaje: message,
      tipo: 'saliente',
      fecha: new Date().toISOString(),
    })
  } catch {
    // ignore log errors
  }
}

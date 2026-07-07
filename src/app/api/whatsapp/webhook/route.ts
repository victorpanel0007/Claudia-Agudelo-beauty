import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage, sendAppointmentConfirmation } from '@/lib/evolution-api'
import { notificarEspecialista } from '@/lib/notificaciones'
import { CATEGORIAS, SERVICIOS_DATA } from '@/lib/services-data'
import { getAvailableSlots, createAppointment, type AvailableSlot } from '@/lib/scheduling'
import { parseFlexibleDate } from '@/lib/date-parser'
import { formatDate, formatCurrency } from '@/lib/utils'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ConvRow {
  telefono:         string
  paso:             string
  categoria_id?:    string | null
  servicio_nombre?: string | null
  duracion?:        number | null
  precio?:          string | null
  nombre?:          string | null
  fecha?:           string | null
  especialista_id?: string | null
  slots_json?:      AvailableSlot[] | null
}

type Supabase = Awaited<ReturnType<typeof createAdminClient>>

// ── Numeración en negrita ─────────────────────────────────────────────────────

/**
 * Devuelve el número formateado en negrita y con punto para usar en menús.
 * WhatsApp renderiza *1.* como negrita → se ve grande y profesional.
 */
function n(i: number): string {
  return `*${i}.*`
}

// ── Constructores de menús ────────────────────────────────────────────────────

function buildMainMenu(): string {
  const items = CATEGORIAS.map((cat, i) => `${n(i + 1)} ${cat.icono} ${cat.nombre}`).join('\n')
  return `🌸 *CLAUDIA AGUDELO BEAUTY*

¡Hola! 😊 Será un gusto atenderte.

Selecciona una categoría:

${items}

_Escribe el número de tu opción._`
}

function buildCategoryMenu(categoriaId: string): string {
  const cat      = CATEGORIAS.find(c => c.id === categoriaId)!
  const servicios = SERVICIOS_DATA.filter(s => s.cat === categoriaId)

  const items = servicios.map((s, i) => {
    let precio = ''
    if (s.tipo === 'fijo' && s.precio) {
      precio = `  ·  $${s.precio.toLocaleString('es-CO')}`
    } else if (s.tipo === 'desde' && s.precio_desde) {
      precio = `  ·  desde $${s.precio_desde.toLocaleString('es-CO')}`
    }
    return `${n(i + 1)} ${s.nombre}${precio}`
  }).join('\n')

  return `${cat.icono} *${cat.nombre.toUpperCase()}*

${items}

_Escribe el número del servicio deseado._`
}

function buildEspecialistaMenu(
  especialistas: Array<{ id: string; nombre: string }>,
  fechaInterpretada: string
): string {
  const items = especialistas.map((e, i) => `${n(i + 1)} ${e.nombre}`).join('\n')
  const totalEsp = especialistas.length

  return `📅 Fecha confirmada: *${fechaInterpretada}* ✅

👩 *¿Con qué especialista prefieres tu cita?*

${items}
${n(totalEsp + 1)} Cualquiera disponible

_Escribe el número de tu opción._`
}

function buildHorariosMenu(slots: AvailableSlot[], fechaDisplay: string): string {
  const items = slots.map((s, i) =>
    `${n(i + 1)} *${s.hora}*  ·  ${s.especialista_nombre}`
  ).join('\n')

  return `🕒 *HORARIOS DISPONIBLES*
📅 ${fechaDisplay}

${items}

_Escribe el número del horario que prefieres._`
}

// ── Helpers de estado en Supabase ─────────────────────────────────────────────

async function getConv(telefono: string, supabase: Supabase): Promise<ConvRow | null> {
  // Limpiar conversaciones con más de 2 horas de inactividad
  await supabase
    .from('conversaciones_bot')
    .delete()
    .lt('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())

  const { data } = await supabase
    .from('conversaciones_bot')
    .select('*')
    .eq('telefono', telefono)
    .maybeSingle()

  return data as ConvRow | null
}

async function setConv(supabase: Supabase, row: ConvRow): Promise<void> {
  await supabase
    .from('conversaciones_bot')
    .upsert(row, { onConflict: 'telefono' })
}

async function delConv(telefono: string, supabase: Supabase): Promise<void> {
  await supabase
    .from('conversaciones_bot')
    .delete()
    .eq('telefono', telefono)
}

// ── Webhook principal ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.event !== 'messages.upsert') {
      return NextResponse.json({ ok: true })
    }

    const message  = body.data?.message
    const from     = body.data?.key?.remoteJid?.replace('@s.whatsapp.net', '')
    const isFromMe = body.data?.key?.fromMe

    if (!from || isFromMe || !message) {
      return NextResponse.json({ ok: true })
    }

    // Ignorar mensajes de grupos
    const remoteJid: string = body.data?.key?.remoteJid ?? ''
    if (remoteJid.endsWith('@g.us')) {
      console.info('[Webhook] Mensaje de grupo ignorado')
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
    console.error('[Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── Procesador principal ──────────────────────────────────────────────────────

async function processMessage(telefono: string, text: string) {
  const supabase  = await createAdminClient()
  const lowerText = text.toLowerCase().trim()

  // Log mensaje entrante
  await supabase.from('mensajes_whatsapp').insert({
    telefono,
    mensaje: text,
    tipo:    'entrante',
    fecha:   new Date().toISOString(),
  })

  // Palabras clave de reinicio → borrar conversación y mostrar menú principal
  const resetWords = [
    'hola', 'buenas', 'buenos días', 'buenos dias',
    'buenas tardes', 'buenas noches',
    'quiero una cita', 'agendar', 'reservar',
    'información', 'informacion',
    'inicio', 'menu', 'menú', 'hi', 'hello',
    '0', 'cancelar', 'reiniciar',
  ]
  if (resetWords.some(w => lowerText === w || lowerText.startsWith(w + ' '))) {
    await delConv(telefono, supabase)
    await reply(telefono, buildMainMenu(), supabase)
    await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
    return
  }

  const conv = await getConv(telefono, supabase)

  // Sin conversación activa → mostrar menú principal
  if (!conv) {
    await reply(telefono, buildMainMenu(), supabase)
    await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
    return
  }

  switch (conv.paso) {
    case 'seleccion_categoria':
      await handleCategorySelection(telefono, text, conv, supabase); break
    case 'seleccion_servicio':
      await handleServiceSelection(telefono, text, conv, supabase); break
    case 'solicitar_nombre':
      await handleNombreInput(telefono, text, conv, supabase); break
    case 'solicitar_fecha':
      await handleFechaInput(telefono, text, conv, supabase); break
    case 'seleccion_especialista':
      await handleEspecialistaSelection(telefono, text, conv, supabase); break
    case 'seleccion_horario':
      await handleHorarioSelection(telefono, text, conv, supabase); break
    default:
      await delConv(telefono, supabase)
      await reply(telefono, buildMainMenu(), supabase)
      await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
  }
}

// ── Pasos del flujo ───────────────────────────────────────────────────────────

async function handleCategorySelection(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > CATEGORIAS.length) {
    await reply(
      telefono,
      `❌ Opción no válida. Escribe un número del *1* al *${CATEGORIAS.length}*.`,
      supabase
    )
    return
  }
  const cat = CATEGORIAS[num - 1]
  await setConv(supabase, { ...conv, categoria_id: cat.id, paso: 'seleccion_servicio' })
  await reply(telefono, buildCategoryMenu(cat.id), supabase)
}

async function handleServiceSelection(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const servicios = SERVICIOS_DATA.filter(s => s.cat === conv.categoria_id)
  const num       = parseInt(text)

  if (isNaN(num) || num < 1 || num > servicios.length) {
    await reply(
      telefono,
      `❌ Opción no válida. Escribe un número del *1* al *${servicios.length}*.`,
      supabase
    )
    return
  }
  const servicio = servicios[num - 1]

  let precio: string
  if (servicio.tipo === 'fijo' && servicio.precio) {
    precio = formatCurrency(servicio.precio)
  } else if (servicio.tipo === 'desde' && servicio.precio_desde) {
    precio = `Desde ${formatCurrency(servicio.precio_desde)}`
  } else {
    precio = 'Requiere valoración'
  }

  await setConv(supabase, {
    ...conv,
    servicio_nombre: servicio.nombre,
    duracion:        servicio.duracion,
    precio,
    paso:            'solicitar_nombre',
  })

  let priceMsg = ''
  if (servicio.tipo === 'valoracion' || servicio.requiere_valoracion) {
    priceMsg = `\n\nℹ️ El precio final dependerá de:\n• Largo del cabello\n• Cantidad de cabello\n• Técnica utilizada\n• Productos necesarios`
  } else {
    priceMsg = `\n\n💵 Precio: *${precio}*\n⏱️ Duración: *${servicio.duracion} minutos*`
  }

  await reply(
    telefono,
    `💅 *${servicio.nombre}*${priceMsg}\n\n✍️ Por favor escribe tu *nombre completo*:`,
    supabase
  )
}

async function handleNombreInput(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  if (text.length < 3) {
    await reply(telefono, '❌ Por favor escribe tu nombre completo (mínimo 3 caracteres).', supabase)
    return
  }
  await setConv(supabase, { ...conv, nombre: text, paso: 'solicitar_fecha' })
  await reply(
    telefono,
    `👋 Hola *${text}*!\n\n📅 ¿Qué fecha prefieres para tu cita?\n\nPuedes escribir de cualquier forma:\n• *mañana*\n• *próximo sábado*\n• *15/06/2026*\n• *15 de junio*\n• *dentro de 3 días*`,
    supabase
  )
}

async function handleFechaInput(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
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

  const todayColStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  if (parsed.iso < todayColStr) {
    await reply(
      telefono,
      `❌ La fecha *${parsed.display}* ya pasó.\n\nElige una fecha futura. Ejemplos:\n• *mañana*\n• *próximo sábado*\n• *20/07/2026*`,
      supabase
    )
    return
  }

  await setConv(supabase, {
    ...conv,
    fecha: parsed.fecha.toISOString(),
    paso:  'seleccion_especialista',
  })

  const { data: especialistas } = await supabase
    .from('especialistas')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  await reply(
    telefono,
    buildEspecialistaMenu(especialistas || [], parsed.interpreted),
    supabase
  )
}

async function handleEspecialistaSelection(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const { data: especialistas } = await supabase
    .from('especialistas')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  const lista    = especialistas || []
  const totalEsp = lista.length
  const num      = parseInt(text)

  if (isNaN(num) || num < 1 || num > totalEsp + 1) {
    await reply(
      telefono,
      `❌ Por favor escribe un número del *1* al *${totalEsp + 1}*.`,
      supabase
    )
    return
  }

  const especialistaId = num <= totalEsp ? lista[num - 1].id : undefined

  await reply(telefono, `🔍 Buscando horarios disponibles...`, supabase)

  const fecha    = new Date(conv.fecha!)
  const duracion = conv.duracion ?? 60
  const slots    = await getAvailableSlots(fecha, duracion, especialistaId)

  if (!slots.length) {
    const espNombre = num <= totalEsp ? lista[num - 1].nombre : 'ninguna especialista'
    await reply(
      telefono,
      `😔 No hay disponibilidad para *${formatDate(fecha)}* con *${espNombre}*.\n\nPor favor elige otra fecha:\n• *mañana*\n• *próximo lunes*\n• *20/07/2026*`,
      supabase
    )
    await setConv(supabase, { ...conv, paso: 'solicitar_fecha' })
    return
  }

  const MAX_SHOW = 20
  const shown    = slots.slice(0, MAX_SHOW)

  await setConv(supabase, {
    ...conv,
    especialista_id: especialistaId ?? null,
    slots_json:      shown,
    paso:            'seleccion_horario',
  })

  const extraMsg = slots.length > MAX_SHOW
    ? `\n_Mostrando ${MAX_SHOW} de ${slots.length} horarios. Si ninguno te funciona, escribe otra fecha._`
    : ''

  await reply(
    telefono,
    buildHorariosMenu(shown, formatDate(fecha)) + extraMsg,
    supabase
  )
}

async function handleHorarioSelection(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const slots = (conv.slots_json as AvailableSlot[] | null) ?? []
  const num   = parseInt(text)

  if (isNaN(num) || num < 1 || num > slots.length) {
    await reply(
      telefono,
      `❌ Por favor escribe un número del *1* al *${slots.length}*.`,
      supabase
    )
    return
  }

  const selectedSlot = slots[num - 1]

  // Buscar o crear cliente
  let clienteId: string | undefined
  const { data: existingClient } = await supabase
    .from('clientes')
    .select('id')
    .eq('telefono', telefono)
    .maybeSingle()

  if (existingClient) {
    clienteId = existingClient.id
  } else {
    const { data: newClient } = await supabase
      .from('clientes')
      .insert({ nombre: conv.nombre, telefono, fecha_registro: new Date().toISOString() })
      .select('id')
      .single()
    clienteId = newClient?.id
  }

  if (!clienteId) {
    await reply(telefono, '❌ Hubo un error al procesar tu reserva. Por favor escribe *hola* para intentar de nuevo.', supabase)
    return
  }

  // Buscar servicio en BD
  const { data: servicio } = await supabase
    .from('servicios')
    .select('id')
    .ilike('nombre', conv.servicio_nombre ?? '')
    .maybeSingle()

  if (!servicio) {
    await reply(telefono, '❌ Servicio no encontrado. Por favor escribe *hola* para intentar de nuevo.', supabase)
    await delConv(telefono, supabase)
    return
  }

  const cita = await createAppointment({
    cliente_id:      clienteId,
    especialista_id: selectedSlot.especialista_id,
    servicio_id:     servicio.id,
    fecha_inicio:    selectedSlot.fecha_inicio,
    fecha_fin:       selectedSlot.fecha_fin,
  })

  if (!cita) {
    await reply(
      telefono,
      '❌ Lo sentimos, ese horario ya fue reservado. Por favor escribe *hola* para elegir otro horario.',
      supabase
    )
    await delConv(telefono, supabase)
    return
  }

  // Limpiar conversación antes de responder
  await delConv(telefono, supabase)

  const fecha = new Date(selectedSlot.fecha_inicio)
  await sendAppointmentConfirmation(telefono, {
    cliente:      conv.nombre!,
    servicio:     conv.servicio_nombre!,
    especialista: selectedSlot.especialista_nombre,
    fecha:        formatDate(fecha),
    hora:         selectedSlot.hora,
    precio:       conv.precio || 'A definir en la cita',
  })

  // Notificar a la especialista
  const { data: citaCompleta } = await supabase
    .from('citas')
    .select('*, cliente:clientes(nombre, telefono), servicio:servicios(nombre, duracion_minutos), especialista:especialistas(id, nombre, whatsapp, notificaciones)')
    .eq('id', cita.id)
    .single()

  if (citaCompleta) {
    notificarEspecialista({ ...citaCompleta, canal: 'whatsapp' }, supabase)
      .catch(e => console.error('[Webhook] Error notificando especialista:', e))
  }

  await supabase.from('mensajes_whatsapp').insert({
    cliente_id: clienteId,
    telefono,
    mensaje:    `✅ Cita confirmada: ${conv.servicio_nombre} con ${selectedSlot.especialista_nombre} el ${formatDate(fecha)} a las ${selectedSlot.hora}`,
    tipo:       'sistema',
    fecha:      new Date().toISOString(),
  })
}

// ── Helper: enviar y loggear mensaje saliente ─────────────────────────────────

async function reply(telefono: string, message: string, supabase: Supabase) {
  sendWhatsAppMessage(telefono, message).catch(e =>
    console.error(`[WhatsApp send failed to ${telefono}]:`, e?.message)
  )
  try {
    await supabase.from('mensajes_whatsapp').insert({
      telefono,
      mensaje: message,
      tipo:    'saliente',
      fecha:   new Date().toISOString(),
    })
  } catch {
    // no bloquear el flujo si el log falla
  }
}

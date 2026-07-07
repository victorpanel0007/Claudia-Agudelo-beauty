import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage, sendWhatsAppList, sendAppointmentConfirmation } from '@/lib/evolution-api'
import { notificarEspecialista } from '@/lib/notificaciones'
import { CATEGORIAS, SERVICIOS_DATA } from '@/lib/services-data'
import { getAvailableSlots, createAppointment, type AvailableSlot } from '@/lib/scheduling'
import { parseFlexibleDate } from '@/lib/date-parser'
import { formatDate, formatCurrency } from '@/lib/utils'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ConvRow {
  telefono:        string
  paso:            string
  categoria_id?:   string | null
  servicio_nombre?: string | null
  duracion?:       number | null
  precio?:         string | null
  nombre?:         string | null
  fecha?:          string | null
  especialista_id?: string | null
  slots_json?:     AvailableSlot[] | null
}

type Supabase = Awaited<ReturnType<typeof createAdminClient>>

// ── Listas interactivas ───────────────────────────────────────────────────────

/** Límite de filas por sección en WhatsApp Send List */
const WA_LIST_MAX_ROWS = 10

/**
 * Envía el menú principal con categorías como lista interactiva.
 * Fallback automático a texto si la API falla (implementado en sendWhatsAppList).
 */
async function replyMainMenu(telefono: string, supabase: Supabase) {
  // WhatsApp limita a 10 filas por sección; si hay más de 10 categorías
  // las dividimos en secciones de 10.
  const chunks: typeof CATEGORIAS[] = []
  for (let i = 0; i < CATEGORIAS.length; i += WA_LIST_MAX_ROWS) {
    chunks.push(CATEGORIAS.slice(i, i + WA_LIST_MAX_ROWS))
  }

  const sections = chunks.map((chunk, idx) => ({
    title: chunks.length > 1 ? `Categorías (${idx + 1})` : 'Nuestros servicios',
    rows: chunk.map(cat => ({
      rowId:       `categoria_${cat.id}`,
      title:       cat.nombre.slice(0, 24),
      description: cat.icono,
    })),
  }))

  await replyList(telefono, {
    title:       '🌸 Claudia Agudelo Beauty',
    description: '¡Hola! 😊 Será un gusto atenderte.\nSelecciona una categoría.',
    buttonText:  '✨ Ver categorías',
    sections,
    footer:      'Escribe "hola" en cualquier momento para reiniciar.',
  }, supabase)
}

/**
 * Envía los servicios de una categoría como lista interactiva.
 */
async function replyCategoryServices(
  telefono: string, categoriaId: string, supabase: Supabase
) {
  const cat      = CATEGORIAS.find(c => c.id === categoriaId)
  const servicios = SERVICIOS_DATA.filter(s => s.cat === categoriaId)

  if (!cat || !servicios.length) {
    await reply(telefono, '❌ No se encontraron servicios para esa categoría.', supabase)
    return
  }

  // Armar filas (máx 10 por sección de WhatsApp)
  const rows = servicios.map((s, i) => {
    let desc = `⏱ ${s.duracion} min`
    if (s.tipo === 'fijo' && s.precio) {
      desc += ` — $${s.precio.toLocaleString('es-CO')}`
    } else if (s.tipo === 'desde' && s.precio_desde) {
      desc += ` — desde $${s.precio_desde.toLocaleString('es-CO')}`
    } else {
      desc += ' — precio en valoración'
    }
    return {
      rowId:       `servicio_${categoriaId}_${i}`,
      title:       s.nombre.slice(0, 24),
      description: desc.slice(0, 72),
    }
  })

  // Dividir en secciones si supera el límite
  const sections = []
  for (let i = 0; i < rows.length; i += WA_LIST_MAX_ROWS) {
    sections.push({
      title: rows.length > WA_LIST_MAX_ROWS
        ? `Servicios (${Math.floor(i / WA_LIST_MAX_ROWS) + 1})`
        : cat.nombre,
      rows:  rows.slice(i, i + WA_LIST_MAX_ROWS),
    })
  }

  await replyList(telefono, {
    title:       `${cat.icono} ${cat.nombre}`,
    description: 'Selecciona el servicio que deseas reservar.',
    buttonText:  '📋 Ver servicios',
    sections,
    footer:      'Escribe "hola" para volver al inicio.',
  }, supabase)
}

/**
 * Envía la lista de especialistas disponibles.
 */
async function replyEspecialistasList(
  telefono: string,
  especialistas: Array<{ id: string; nombre: string }>,
  parsedDate: { interpreted: string },
  supabase: Supabase
) {
  const rows = especialistas.map(e => ({
    rowId:  `especialista_${e.id}`,
    title:  e.nombre.slice(0, 24),
    description: 'Especialista disponible',
  }))

  // Opción "cualquiera"
  rows.push({
    rowId:       'especialista_cualquiera',
    title:       'Cualquiera disponible',
    description: 'El primer horario libre',
  })

  await replyList(telefono, {
    title:       '👩 Especialistas disponibles',
    description: `Para *${parsedDate.interpreted}*.\nSelecciona quién realizará tu servicio.`,
    buttonText:  '👩 Ver especialistas',
    sections:    [{ title: 'Especialistas', rows }],
    footer:      'Escribe "hola" para volver al inicio.',
  }, supabase)
}

/**
 * Envía la lista de horarios disponibles.
 */
async function replyHorariosList(
  telefono: string,
  slots: AvailableSlot[],
  fechaDisplay: string,
  supabase: Supabase
) {
  const MAX_SHOW = 10 // WhatsApp limita 10 filas por sección

  // Agrupar por especialista si hay varios
  const byEsp = new Map<string, AvailableSlot[]>()
  for (const slot of slots.slice(0, MAX_SHOW)) {
    const key = slot.especialista_nombre
    if (!byEsp.has(key)) byEsp.set(key, [])
    byEsp.get(key)!.push(slot)
  }

  const sections = Array.from(byEsp.entries()).map(([nombre, espSlots]) => ({
    title: nombre.slice(0, 24),
    rows:  espSlots.map((s, i) => ({
      rowId:       `horario_${i}_${encodeRowId(s.fecha_inicio)}`,
      title:       s.hora,
      description: `Con ${s.especialista_nombre}`.slice(0, 72),
    })),
  }))

  const extraMsg = slots.length > MAX_SHOW
    ? `\nMostrando ${MAX_SHOW} de ${slots.length} horarios.`
    : ''

  await replyList(telefono, {
    title:       '🕒 Horarios disponibles',
    description: `Para *${fechaDisplay}*.\nSelecciona la hora que prefieras.${extraMsg}`,
    buttonText:  '📅 Ver horarios',
    sections,
    footer:      'Si ninguno te funciona, escribe otra fecha.',
  }, supabase)
}

/** Codifica una fecha ISO en un rowId seguro (sin caracteres especiales) */
function encodeRowId(iso: string): string {
  return iso.replace(/[^0-9T]/g, '').slice(0, 15)
}

// ── Helper reply con lista ────────────────────────────────────────────────────

async function replyList(
  telefono: string,
  opts: {
    title: string
    description: string
    buttonText: string
    sections: Array<{ title: string; rows: Array<{ rowId: string; title: string; description?: string }> }>
    footer?: string
  },
  supabase: Supabase
) {
  const result = await sendWhatsAppList({
    to:          telefono,
    title:       opts.title,
    description: opts.description,
    buttonText:  opts.buttonText,
    sections:    opts.sections,
    footer:      opts.footer,
  })

  // Loggear mensaje saliente (texto de fallback o descripción)
  const logMsg = `[Lista] ${opts.title}: ${opts.description}`
  try {
    await supabase.from('mensajes_whatsapp').insert({
      telefono,
      mensaje: logMsg.slice(0, 500),
      tipo:    'saliente',
      fecha:   new Date().toISOString(),
    })
  } catch { /* no bloquear */ }

  if (!result.ok) {
    console.error('[replyList] Error enviando lista:', result.errorMessage)
  }
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

    const message    = body.data?.message
    const from       = body.data?.key?.remoteJid?.replace('@s.whatsapp.net', '')
    const isFromMe   = body.data?.key?.fromMe

    if (!from || isFromMe || !message) {
      return NextResponse.json({ ok: true })
    }

    // Ignorar mensajes de grupos
    const remoteJid: string = body.data?.key?.remoteJid ?? ''
    if (remoteJid.endsWith('@g.us')) {
      console.info('[Webhook] Mensaje de grupo ignorado')
      return NextResponse.json({ ok: true })
    }

    // Texto normal o selección de lista interactiva (listResponseMessage)
    const text = (
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      // Respuesta de lista interactiva — viene como rowId
      message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
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
  const supabase   = await createAdminClient()
  const lowerText  = text.toLowerCase().trim()

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
    await replyMainMenu(telefono, supabase)
    await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
    return
  }

  const conv = await getConv(telefono, supabase)

  // Sin conversación activa → mostrar menú principal
  if (!conv) {
    await replyMainMenu(telefono, supabase)
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
      await replyMainMenu(telefono, supabase)
      await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
  }
}

// ── Pasos del flujo ───────────────────────────────────────────────────────────

async function handleCategorySelection(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  // Acepta rowId de lista ("categoria_3") o número escrito ("3")
  let cat = CATEGORIAS.find(c => text === `categoria_${c.id}`)

  if (!cat) {
    const num = parseInt(text)
    if (!isNaN(num) && num >= 1 && num <= CATEGORIAS.length) {
      cat = CATEGORIAS[num - 1]
    }
  }

  if (!cat) {
    await reply(telefono, `❌ Opción no válida. Por favor selecciona una categoría de la lista o escribe un número del 1 al ${CATEGORIAS.length}.`, supabase)
    return
  }

  await setConv(supabase, { ...conv, categoria_id: cat.id, paso: 'seleccion_servicio' })
  await replyCategoryServices(telefono, cat.id, supabase)
}

async function handleServiceSelection(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const servicios = SERVICIOS_DATA.filter(s => s.cat === conv.categoria_id)

  // Acepta rowId de lista ("servicio_3_2") o número escrito ("3")
  let servicioIdx = -1
  const rowIdMatch = text.match(/^servicio_\d+_(\d+)$/)
  if (rowIdMatch) {
    servicioIdx = parseInt(rowIdMatch[1])
  } else {
    const num = parseInt(text)
    if (!isNaN(num) && num >= 1 && num <= servicios.length) {
      servicioIdx = num - 1
    }
  }

  if (servicioIdx < 0 || servicioIdx >= servicios.length) {
    await reply(telefono, `❌ Opción no válida. Por favor selecciona un servicio de la lista o escribe un número del 1 al ${servicios.length}.`, supabase)
    return
  }

  const servicio = servicios[servicioIdx]

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

  await replyEspecialistasList(telefono, especialistas || [], parsed, supabase)
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

  // Acepta rowId ("especialista_<uuid>" o "especialista_cualquiera") o número escrito
  let especialistaId: string | undefined

  if (text === 'especialista_cualquiera') {
    especialistaId = undefined
  } else if (text.startsWith('especialista_')) {
    const idPart = text.replace('especialista_', '')
    const found  = lista.find(e => e.id === idPart)
    if (found) especialistaId = found.id
  } else {
    const num = parseInt(text)
    if (!isNaN(num) && num >= 1 && num <= totalEsp + 1) {
      especialistaId = num <= totalEsp ? lista[num - 1].id : undefined
    } else {
      await reply(telefono, `❌ Por favor selecciona una especialista de la lista o escribe un número del 1 al ${totalEsp + 1}.`, supabase)
      return
    }
  }

  await reply(telefono, `🔍 Buscando horarios disponibles...`, supabase)

  const fecha    = new Date(conv.fecha!)
  const duracion = conv.duracion ?? 60
  const slots    = await getAvailableSlots(fecha, duracion, especialistaId)

  if (!slots.length) {
    const espNombre = especialistaId
      ? (lista.find(e => e.id === especialistaId)?.nombre ?? 'esa especialista')
      : 'ninguna especialista'
    await reply(
      telefono,
      `😔 No hay disponibilidad para *${formatDate(fecha)}* con *${espNombre}*.\n\nPor favor elige otra fecha:\n• *mañana*\n• *próximo lunes*\n• *20/07/2026*`,
      supabase
    )
    await setConv(supabase, { ...conv, paso: 'solicitar_fecha' })
    return
  }

  // WhatsApp limita 10 filas por sección → mostramos máx 10
  const MAX_SHOW = 10
  const shown = slots.slice(0, MAX_SHOW)

  await setConv(supabase, {
    ...conv,
    especialista_id: especialistaId ?? null,
    slots_json:      shown,
    paso:            'seleccion_horario',
  })

  await replyHorariosList(telefono, shown, formatDate(fecha), supabase)
}

async function handleHorarioSelection(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const slots = (conv.slots_json as AvailableSlot[] | null) ?? []

  // Acepta rowId ("horario_<idx>_<encoded_iso>") o número escrito
  let selectedSlot: AvailableSlot | undefined

  const rowIdMatch = text.match(/^horario_(\d+)_/)
  if (rowIdMatch) {
    const idx = parseInt(rowIdMatch[1])
    selectedSlot = slots[idx]
  } else {
    const num = parseInt(text)
    if (!isNaN(num) && num >= 1 && num <= slots.length) {
      selectedSlot = slots[num - 1]
    }
  }

  if (!selectedSlot) {
    await reply(telefono, `❌ Por favor selecciona un horario de la lista o escribe un número del 1 al ${slots.length}.`, supabase)
    return
  }

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

// ── Helper: enviar y loggear mensaje saliente ────────────────────────────────

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

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage, sendAppointmentConfirmation } from '@/lib/evolution-api'
import { getAvailableSlots, createAppointment, type AvailableSlot } from '@/lib/scheduling'
import { parseFlexibleDate } from '@/lib/date-parser'
import { formatDate, formatCurrency } from '@/lib/utils'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ConvRow {
  telefono:        string
  paso:            string
  categoria_id?:   string | null
  servicio_nombre?: string | null
  servicio_id?:    string | null   // ID real del servicio en BD (source of truth)
  duracion?:       number | null
  precio?:         string | null
  nombre?:         string | null
  fecha?:          string | null
  especialista_id?: string | null
  slots_json?:     AvailableSlot[] | null
}

interface CatDB {
  id:     string
  nombre: string
  icono:  string
  orden:  number
}

interface SvcDB {
  id:                  string
  nombre:              string
  tipo_precio:         string
  precio?:             number | null
  precio_desde?:       number | null
  duracion_minutos:    number
  categoria_id:        string
  requiere_valoracion?: boolean
}

type Supabase = Awaited<ReturnType<typeof createAdminClient>>

// ── Catálogo desde BD ────────────────────────────────────────────────────────
// Siempre leemos categorías y servicios desde Supabase para que el bot
// muestre y procese exactamente los mismos datos que existen en la BD.

async function getCategorias(supabase: Supabase): Promise<CatDB[]> {
  const { data } = await supabase
    .from('categorias')
    .select('id, nombre, icono, orden')
    .order('orden')
  return (data ?? []) as CatDB[]
}

async function getServiciosByCategoria(supabase: Supabase, categoriaId: string): Promise<SvcDB[]> {
  const { data } = await supabase
    .from('servicios')
    .select('id, nombre, tipo_precio, precio, precio_desde, duracion_minutos, categoria_id, requiere_valoracion')
    .eq('categoria_id', categoriaId)
    .eq('activo', true)
    .order('nombre')
  return (data ?? []) as SvcDB[]
}

function buildCategoryMenuFromDB(cat: CatDB, servicios: SvcDB[]): string {
  const lista = servicios.map((s, i) => {
    let precio = ''
    if (s.tipo_precio === 'fijo' && s.precio) {
      precio = ` — $${Number(s.precio).toLocaleString('es-CO')}`
    } else if (s.tipo_precio === 'desde' && s.precio_desde) {
      precio = ` desde — $${Number(s.precio_desde).toLocaleString('es-CO')}`
    }
    return `${getNumberEmoji(i + 1)} ${s.nombre}${precio}`
  }).join('\n')
  return `${cat.icono} *${cat.nombre.toUpperCase()}*\n\n${lista}\n\n✍️ Escribe el número del servicio deseado.`
}

function getNumberEmoji(n: number): string {
  const emojis: Record<number, string> = {
    1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣',
    6: '6️⃣', 7: '7️⃣', 8: '8️⃣', 9: '9️⃣', 10: '🔟',
    11: '1️⃣1️⃣', 12: '1️⃣2️⃣', 13: '1️⃣3️⃣', 14: '1️⃣4️⃣',
    15: '1️⃣5️⃣', 16: '1️⃣6️⃣', 17: '1️⃣7️⃣', 18: '1️⃣8️⃣',
    19: '1️⃣9️⃣', 20: '2️⃣0️⃣',
  }
  return emojis[n] || `${n}.`
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

function buildMainMenu(categorias: CatDB[]): string {
  const menu = categorias.map((cat, i) => `${getNumberEmoji(i + 1)} ${cat.nombre}`).join('\n')
  return `🤖 *MENÚ PRINCIPAL*\n\n¡Hola! 👋 Bienvenido(a) a *Claudia Agudelo Beauty* 💖\n\nPor favor responde con el número del servicio que deseas:\n\n${menu}\n\n✍️ Escribe el número de la opción deseada.`
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

export async function processMessage(telefono: string, text: string) {
  const supabase   = await createAdminClient()
  const lowerText  = text.toLowerCase().trim()

  // Log mensaje entrante
  await supabase.from('mensajes_whatsapp').insert({
    telefono,
    mensaje: text,
    tipo:    'entrante',
    fecha:   new Date().toISOString(),
  })

  // Palabras clave de reinicio → borrar conversación y mostrar menú
  const resetWords = ['hola', 'inicio', 'menu', 'menú', 'hi', 'hello', '0', 'cancelar', 'reiniciar']
  if (resetWords.includes(lowerText)) {
    await delConv(telefono, supabase)
    const categorias = await getCategorias(supabase)
    const menuPrincipal = buildMainMenu(categorias)
    await reply(telefono, menuPrincipal, supabase)
    await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
    return
  }

  const conv = await getConv(telefono, supabase)

  // Sin conversación activa → mostrar menú
  if (!conv) {
    const categorias = await getCategorias(supabase)
    const menuPrincipal = buildMainMenu(categorias)
    await reply(telefono, menuPrincipal, supabase)
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
      const cats = await getCategorias(supabase)
      await reply(telefono, buildMainMenu(cats), supabase)
      await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
  }
}

// ── Pasos del flujo ───────────────────────────────────────────────────────────

async function handleCategorySelection(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const categorias = await getCategorias(supabase)
  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > categorias.length) {
    await reply(telefono, `❌ Opción no válida. Por favor escribe un número del 1 al ${categorias.length}.`, supabase)
    return
  }
  const cat = categorias[num - 1]
  const servicios = await getServiciosByCategoria(supabase, cat.id)
  await setConv(supabase, { ...conv, categoria_id: cat.id, paso: 'seleccion_servicio' })
  await reply(telefono, buildCategoryMenuFromDB(cat, servicios), supabase)
}

async function handleServiceSelection(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const servicios = await getServiciosByCategoria(supabase, conv.categoria_id ?? '')
  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > servicios.length) {
    await reply(telefono, `❌ Opción no válida. Por favor escribe un número del 1 al ${servicios.length}.`, supabase)
    return
  }
  // El servicio viene directamente de la BD — ID y nombre son exactos
  const servicio = servicios[num - 1]

  let precio: string
  if (servicio.tipo_precio === 'fijo' && servicio.precio) {
    precio = formatCurrency(servicio.precio)
  } else if (servicio.tipo_precio === 'desde' && servicio.precio_desde) {
    precio = `Desde ${formatCurrency(servicio.precio_desde)}`
  } else {
    precio = 'Requiere valoración'
  }

  // Guardamos el ID real directamente — no se necesita búsqueda posterior
  await setConv(supabase, {
    ...conv,
    servicio_nombre: servicio.nombre,
    servicio_id:     servicio.id,   // source of truth: ID real de la BD
    duracion:        servicio.duracion_minutos,
    precio,
    paso:            'solicitar_nombre',
  })

  let priceMsg = ''
  if (servicio.tipo_precio === 'valoracion' || servicio.requiere_valoracion) {
    priceMsg = `\n\nℹ️ El precio final dependerá de:\n• Largo del cabello\n• Cantidad de cabello\n• Técnica utilizada\n• Productos necesarios`
  } else {
    priceMsg = `\n\n💵 Precio: *${precio}*\n⏱️ Duración: *${servicio.duracion_minutos} minutos*`
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

  const lista = (especialistas || []).map((e, i) => `${i + 1}️⃣ ${e.nombre}`).join('\n')
  const totalEsp = (especialistas || []).length

  await reply(
    telefono,
    `📅 Fecha confirmada: *${parsed.interpreted}* ✅\n\n👩 ¿Qué especialista prefieres?\n\n${lista}\n${totalEsp + 1}️⃣ Cualquiera disponible`,
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

  const lista     = especialistas || []
  const totalEsp  = lista.length
  const num       = parseInt(text)

  if (isNaN(num) || num < 1 || num > totalEsp + 1) {
    await reply(telefono, `❌ Por favor escribe un número del 1 al ${totalEsp + 1}.`, supabase)
    return
  }

  const especialistaId = num <= totalEsp ? lista[num - 1].id : undefined

  await reply(telefono, `🔍 Buscando horarios disponibles...`, supabase)

  const fecha      = new Date(conv.fecha!)
  const duracion   = conv.duracion ?? 60
  const slots      = await getAvailableSlots(fecha, duracion, especialistaId)

  if (!slots.length) {
    const nombreEsp = num <= totalEsp ? lista[num - 1].nombre : 'ninguna especialista'
    await reply(
      telefono,
      `😔 No hay disponibilidad para *${formatDate(fecha)}* con *${nombreEsp}*.\n\nPor favor elige otra fecha:\n• *mañana*\n• *próximo lunes*\n• *20/07/2026*`,
      supabase
    )
    await setConv(supabase, { ...conv, paso: 'solicitar_fecha' })
    return
  }

  // Guardar todos los slots en la BD — el cliente elige de la lista completa
  // Solo mostramos máximo 20 en el mensaje para no saturar WhatsApp
  const MAX_SHOW = 20
  const shown = slots.slice(0, MAX_SHOW)

  await setConv(supabase, {
    ...conv,
    especialista_id: especialistaId ?? null,
    slots_json:      shown,
    paso:            'seleccion_horario',
  })

  const numberEmojis = [
    '1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟',
    '1️⃣1️⃣','1️⃣2️⃣','1️⃣3️⃣','1️⃣4️⃣','1️⃣5️⃣','1️⃣6️⃣','1️⃣7️⃣','1️⃣8️⃣','1️⃣9️⃣','2️⃣0️⃣',
  ]
  const slotsList = shown
    .map((s, i) => `${numberEmojis[i]} *${s.hora}* — ${s.especialista_nombre}`)
    .join('\n')

  const extraMsg = slots.length > MAX_SHOW
    ? `\n\n_Mostrando ${MAX_SHOW} de ${slots.length} horarios._\n_Si ninguno te funciona, escribe otra fecha._`
    : ''

  await reply(
    telefono,
    `🕐 *Horarios disponibles* para *${formatDate(fecha)}*:\n\n${slotsList}${extraMsg}\n\n✍️ Escribe el número del horario que prefieres:`,
    supabase
  )
}

async function handleHorarioSelection(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const slots = (conv.slots_json as AvailableSlot[] | null) ?? []
  const num   = parseInt(text)

  if (isNaN(num) || num < 1 || num > slots.length) {
    await reply(telefono, `❌ Por favor escribe un número del 1 al ${slots.length}.`, supabase)
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

  // Usar el servicio_id guardado en el momento de la selección (source of truth).
  // Esto garantiza que la cita siempre refleje exactamente el servicio que el cliente eligió,
  // sin riesgo de que una búsqueda tardía por nombre retorne un servicio incorrecto.
  const servicioId = conv.servicio_id

  if (!servicioId) {
    await reply(telefono, '❌ Servicio no encontrado. Por favor escribe *hola* para intentar de nuevo.', supabase)
    await delConv(telefono, supabase)
    return
  }

  const cita = await createAppointment({
    cliente_id:      clienteId,
    especialista_id: selectedSlot.especialista_id,
    servicio_id:     servicioId,
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

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage, sendAppointmentConfirmation } from '@/lib/evolution-api'
import { notificarEspecialista } from '@/lib/notificaciones'
import { CATEGORIAS, SERVICIOS_DATA } from '@/lib/services-data'
import { getAvailableSlots, createAppointment, type AvailableSlot } from '@/lib/scheduling'
import { parseFlexibleDate } from '@/lib/date-parser'
import { formatDate, formatCurrency } from '@/lib/utils'
import { transcribeAudio, extractIntent, type ExtractedData } from '@/lib/openai-service'

// ── Caché de servicios y categorías desde Supabase (TTL 5 min) ───────────────

type SvcDB = {
  id?: string
  nombre: string; tipo_precio: string
  precio?: number | null; precio_desde?: number | null
  duracion_minutos: number; categoria_id?: string
  categoria_nombre?: string  // nombre de la categoría en Supabase
  requiere_valoracion?: boolean
}

type CatDB = { id: string; nombre: string; icono: string; orden: number }

let _svcsCache: SvcDB[] | null = null
let _catsCache: CatDB[] | null = null
let _svcsExpiry = 0
let _catsExpiry = 0

async function getCategorias(): Promise<CatDB[]> {
  if (_catsCache && Date.now() < _catsExpiry) return _catsCache
  try {
    const supabase = await createAdminClient()
    const { data } = await supabase.from('categorias').select('*').order('orden')
    if (data?.length) {
      _catsCache = data as CatDB[]
      _catsExpiry = Date.now() + 10 * 60 * 1000 // 10 min
      return _catsCache
    }
  } catch { /* fallback */ }
  // Fallback al archivo local
  _catsCache = CATEGORIAS.map(c => ({ id: c.id, nombre: c.nombre, icono: c.icono, orden: c.orden }))
  _catsExpiry = Date.now() + 60 * 1000
  return _catsCache
}

async function getServicios(): Promise<SvcDB[]> {
  if (_svcsCache && Date.now() < _svcsExpiry) return _svcsCache
  try {
    const supabase = await createAdminClient()
    const { data } = await supabase
      .from('servicios')
      .select('id, nombre, tipo_precio, precio, precio_desde, duracion_minutos, categoria_id, requiere_valoracion, categoria:categorias(nombre)')
      .eq('activo', true)
      .order('nombre')
    if (data?.length) {
      _svcsCache = data.map(s => ({
        ...s,
        categoria_nombre: (s.categoria as { nombre?: string } | null)?.nombre ?? '',
      }))
      _svcsExpiry = Date.now() + 5 * 60 * 1000
      return _svcsCache
    }
  } catch { /* fallback */ }
  // Fallback al archivo estático
  _svcsCache = SERVICIOS_DATA.map(s => ({
    nombre: s.nombre, tipo_precio: s.tipo,
    precio: 'precio' in s ? s.precio : null,
    precio_desde: 'precio_desde' in s ? s.precio_desde : null,
    duracion_minutos: s.duracion,
    requiere_valoracion: 'requiere_valoracion' in s ? s.requiere_valoracion : false,
    categoria_id: s.cat,
    categoria_nombre: CATEGORIAS.find(c => c.id === s.cat)?.nombre ?? '',
  }))
  _svcsExpiry = Date.now() + 60 * 1000
  return _svcsCache
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

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
  // Para flujo de cancelación
  citas_cancelar_json?: CitaCancelar[] | null
}

interface CitaCancelar {
  id: string
  servicio: string
  especialista: string
  fecha_inicio: string
  hora: string
  fecha_display: string
}

type Supabase = Awaited<ReturnType<typeof createAdminClient>>

// ── Constructores de menú ─────────────────────────────────────────────────────

function nb(i: number) { return `*${i}.*` }

async function buildMainMenu(): Promise<string> {
  const cats = await getCategorias()
  const items = cats.map((c, i) => `${nb(i+1)} ${c.icono} ${c.nombre}`).join('\n')
  return `🌸 *CLAUDIA AGUDELO BEAUTY*\n\n¡Hola! 😊 Será un gusto atenderte.\n\nSelecciona una categoría:\n\n${items}\n\n_Escribe el número de tu opción._`
}

async function buildCategoryMenu(catId: string): Promise<string> {
  // catId puede ser UUID de Supabase o id local ('1','9'...)
  const cats   = await getCategorias()
  const svcs   = await getServicios()

  // Buscar categoría — primero por UUID, luego por id local
  let cat = cats.find(c => c.id === catId)
  // Si no encuentra por UUID, buscar en CATEGORIAS local y obtener nombre
  if (!cat) {
    const catLocal = CATEGORIAS.find(c => c.id === catId)
    if (catLocal) cat = cats.find(c => c.nombre.toLowerCase() === catLocal.nombre.toLowerCase())
  }
  if (!cat) return '❌ Categoría no encontrada.'

  // Servicios de esta categoría — buscar por categoria_id (UUID) o por nombre de categoría
  const serviciosCat = svcs.filter(s =>
    s.categoria_id === cat!.id ||
    s.categoria_nombre?.toLowerCase() === cat!.nombre.toLowerCase()
  ).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  if (!serviciosCat.length) return `${cat.icono} *${cat.nombre.toUpperCase()}*\n\nNo hay servicios disponibles en esta categoría.`

  const items = serviciosCat.map((s, i) => {
    let p = ''
    if (s.tipo_precio === 'fijo'  && s.precio)       p = `  ·  $${Number(s.precio).toLocaleString('es-CO')}`
    if (s.tipo_precio === 'desde' && s.precio_desde) p = `  ·  desde $${Number(s.precio_desde).toLocaleString('es-CO')}`
    return `${nb(i+1)} ${s.nombre}${p}`
  }).join('\n')

  return `${cat.icono} *${cat.nombre.toUpperCase()}*\n\n${items}\n\n_Escribe el número del servicio deseado._`
}

function buildEspecialistaMenu(esps: Array<{ id: string; nombre: string }>, fInterpretada: string): string {
  const items = esps.map((e, i) => `${nb(i+1)} ${e.nombre}`).join('\n')
  return `📅 Fecha confirmada: *${fInterpretada}* ✅\n\n👩 *¿Con qué especialista prefieres tu cita?*\n\n${items}\n${nb(esps.length+1)} Cualquiera disponible\n\n_Escribe el número de tu opción._`
}

function buildHorariosMenu(slots: AvailableSlot[], fDisplay: string): string {
  const items = slots.map((s, i) => `${nb(i+1)} *${s.hora}*  ·  ${s.especialista_nombre}`).join('\n')
  return `🕒 *HORARIOS DISPONIBLES*\n📅 ${fDisplay}\n\n${items}\n\n_Escribe el número del horario que prefieres._`
}

// ── Helpers de pausa del bot ──────────────────────────────────────────────────

const DEFAULT_PAUSA_MINUTOS = 20

/**
 * Verifica si el bot está pausado para un teléfono.
 * Limpia automáticamente las pausas expiradas.
 */
async function isBotPausado(telefono: string, supabase: Supabase): Promise<boolean> {
  const { data } = await supabase
    .from('bot_pausas')
    .select('pausado_hasta')
    .eq('telefono', telefono)
    .maybeSingle()

  if (!data) return false
  if (new Date(data.pausado_hasta) > new Date()) return true

  // Pausa expirada — limpiar
  await supabase.from('bot_pausas').delete().eq('telefono', telefono)
  return false
}

/**
 * Activa o renueva la pausa del bot para un teléfono.
 * Cada llamada reinicia el temporizador a DEFAULT_PAUSA_MINUTOS.
 */
async function pausarBot(telefono: string, supabase: Supabase): Promise<void> {
  const pausado_hasta = new Date(Date.now() + DEFAULT_PAUSA_MINUTOS * 60 * 1000).toISOString()
  await supabase.from('bot_pausas').upsert(
    { telefono, pausado_hasta, pausado_por: 'admin_whatsapp' },
    { onConflict: 'telefono' }
  )
}

async function getConv(telefono: string, supabase: Supabase): Promise<ConvRow | null> {
  await supabase.from('conversaciones_bot').delete()
    .lt('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
  const { data } = await supabase.from('conversaciones_bot').select('*')
    .eq('telefono', telefono).maybeSingle()
  return data as ConvRow | null
}

async function setConv(supabase: Supabase, row: ConvRow): Promise<void> {
  await supabase.from('conversaciones_bot').upsert(row, { onConflict: 'telefono' })
}

async function delConv(telefono: string, supabase: Supabase): Promise<void> {
  await supabase.from('conversaciones_bot').delete().eq('telefono', telefono)
}

// ── Webhook principal ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body     = await request.json()
    if (body.event !== 'messages.upsert') return NextResponse.json({ ok: true })

    const message  = body.data?.message
    const from     = body.data?.key?.remoteJid?.replace('@s.whatsapp.net', '')
    const isFromMe = body.data?.key?.fromMe
    if (!from || !message) return NextResponse.json({ ok: true })

    const remoteJid: string = body.data?.key?.remoteJid ?? ''
    if (remoteJid.endsWith('@g.us')) return NextResponse.json({ ok: true })

    const supabase = await createAdminClient()

    // ── Mensaje del ADMIN (fromMe) → pausar bot para ese chat ────────────────
    if (isFromMe) {
      await pausarBot(from, supabase)
      console.info(`[Pausa] Bot pausado ${DEFAULT_PAUSA_MINUTOS}min para ${from}`)
      return NextResponse.json({ ok: true })
    }

    // ── Mensaje del CLIENTE → verificar si el bot está pausado ───────────────
    if (await isBotPausado(from, supabase)) {
      const text = (message?.conversation || message?.extendedTextMessage?.text || '').trim()
      if (text) {
        try {
          await supabase.from('mensajes_whatsapp').insert({
            telefono: from, mensaje: text, tipo: 'entrante', fecha: new Date().toISOString(),
          })
        } catch { /* no bloquear */ }
      }
      console.info(`[Pausa] Msg de ${from} ignorado — bot pausado (atención humana)`)
      return NextResponse.json({ ok: true })
    }

    const isAudio = !!message?.audioMessage || !!message?.pttMessage
    if (isAudio) {
      await handleAudio(from, body.data)
      return NextResponse.json({ ok: true })
    }

    const text = (message?.conversation || message?.extendedTextMessage?.text || '').trim()
    if (!text) return NextResponse.json({ ok: true })

    await processMessage(from, text)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[Webhook]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── Handler audio ─────────────────────────────────────────────────────────────

async function handleAudio(telefono: string, webhookData: Record<string, unknown>) {
  const supabase = await createAdminClient()
  await reply(telefono, '🎤 Estoy escuchando tu mensaje...\nUn momento por favor 😊', supabase)

  const tr = await transcribeAudio(webhookData)
  try {
    await supabase.from('mensajes_whatsapp').insert({
      telefono, mensaje: `[Audio: ${tr.ok ? 'ok' : tr.errorCode}]`, tipo: 'entrante', fecha: new Date().toISOString(),
    })
  } catch { /* no bloquear */ }

  if (!tr.ok) {
    await reply(telefono, tr.errorCode === 'too_large'
      ? 'El audio es demasiado largo 😊\nPor favor envíalo en una nota de voz más corta.'
      : 'Lo siento 😊\nNo pude entender el audio.\n¿Podrías enviarlo nuevamente o escribir el mensaje?',
      supabase
    )
    return
  }

  console.info(`[Audio] ${telefono} → "${tr.text!.slice(0, 80)}"`)
  // Audio y texto siguen el mismo camino desde aquí
  await processMessage(telefono, tr.text!)
}

// ── Motor principal — único para texto Y audio ────────────────────────────────

async function processMessage(telefono: string, texto: string) {
  const supabase = await createAdminClient()

  try {
    await supabase.from('mensajes_whatsapp').insert({
      telefono, mensaje: texto, tipo: 'entrante', fecha: new Date().toISOString(),
    })
  } catch { /* no bloquear */ }

  const conv = await getConv(telefono, supabase)

  // Palabras de reinicio forzado (sin IA)
  const lower = texto.toLowerCase().trim()
  const resetWords = ['hola','buenas','buenos dias','buenos días','buenas tardes','buenas noches',
    'inicio','menu','menú','hi','hello','0','reiniciar']
  if (resetWords.includes(lower)) {
    await delConv(telefono, supabase)
    // Consultar si el cliente ya existe → saludo personalizado
    const clienteExistente = await buscarCliente(telefono, supabase)
    const menuMsg = await buildMainMenu()
    if (clienteExistente) {
      const saludo = `👋 ¡Hola de nuevo, *${clienteExistente.nombre}*! 💖\nQué gusto tenerte por acá.\n\n${menuMsg}`
      await reply(telefono, saludo, supabase)
    } else {
      await reply(telefono, menuMsg, supabase)
    }
    await setConv(supabase, { telefono, paso: 'seleccion_categoria', nombre: clienteExistente?.nombre ?? null })
    return
  }

  // Si el paso es numérico simple (selección de especialista, horario)
  // o el texto es un número pequeño y hay conversación activa → despachar directo sin IA
  const esNumero = /^\d{1,2}$/.test(texto.trim())
  if (conv && esNumero) {
    await dispatchPaso(telefono, texto.trim(), conv, supabase)
    return
  }

  // Para cualquier otro texto → extraer intención y datos con IA
  const extracted = await extractIntent(texto, {
    paso:             conv?.paso            ?? 'sin_conversacion',
    servicio_nombre:  conv?.servicio_nombre ?? null,
    categoria_id:     conv?.categoria_id    ?? null,
    fecha:            conv?.fecha           ?? null,
    nombre:           conv?.nombre          ?? null,
  })

  console.info(`[Intent] ${telefono} | ${extracted.intencion} | svc=${extracted.servicio} | cat=${extracted.categoria_id} | fecha=${extracted.fecha} | hora=${extracted.hora}`)

  await routeIntent(telefono, extracted, conv, supabase)
}

// ── Router de intenciones ─────────────────────────────────────────────────────
// Regla: extrae todo primero, luego pregunta SOLO lo que falta.

async function routeIntent(
  telefono: string,
  ext: ExtractedData,
  conv: ConvRow | null,
  supabase: Supabase
) {
  switch (ext.intencion) {

    case 'saludo':
    case 'ver_categorias':
      await delConv(telefono, supabase)
      const clienteSaludo = await buscarCliente(telefono, supabase)
      const menuSaludo = await buildMainMenu()
      if (clienteSaludo && ext.intencion === 'saludo') {
        await reply(telefono, `👋 ¡Hola de nuevo, *${clienteSaludo.nombre}*! 💖\nQué gusto tenerte por acá.\n\n${menuSaludo}`, supabase)
      } else {
        await reply(telefono, menuSaludo, supabase)
      }
      await setConv(supabase, { telefono, paso: 'seleccion_categoria', nombre: clienteSaludo?.nombre ?? null })
      return

    case 'ver_servicios':
      if (ext.categoria_id) {
        await setConv(supabase, { telefono, paso: 'seleccion_servicio', categoria_id: ext.categoria_id })
        await reply(telefono, await buildCategoryMenu(ext.categoria_id), supabase)
      } else {
        await delConv(telefono, supabase)
        await reply(telefono, await buildMainMenu(), supabase)
        await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
      }
      return

    case 'consultar_precio':
      await reply(telefono, await buildPrecioResponse(ext.servicio, ext.categoria_id), supabase)
      if (!conv) await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
      return

    case 'cambiar_cita':
      await delConv(telefono, supabase)
      await reply(telefono, '🔄 Para cambiar tu cita contáctanos directamente.\nO escribe *hola* para hacer una nueva reserva.', supabase)
      return

    case 'cancelar_cita':
      await handleCancelarCita(telefono, conv, supabase)
      return

    case 'hablar_asesor':
      await reply(telefono, '👩 Con gusto te comunico con una asesora.\nEn un momento te atenderán 😊', supabase)
      return

    case 'agradecimiento':
    case 'despedida':
      await delConv(telefono, supabase)
      await reply(telefono, '¡Con mucho gusto! 💖\nFue un placer atenderte.\nEn *Claudia Agudelo Beauty* siempre tenemos un espacio para ti. ✨', supabase)
      return

    case 'reservar':
    case 'consultar_disponibilidad':
      await handleReservar(telefono, ext, conv, supabase)
      return

    case 'dato_puntual':
      // El cliente respondió un dato puntual (nombre, fecha, hora, número)
      // Despachar al paso actual del flujo
      if (conv) {
        await dispatchPaso(telefono, ext.textoProcesado, conv, supabase)
      } else {
        await reply(telefono, await buildMainMenu(), supabase)
        await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
      }
      return

    default:
      if (conv) {
        await dispatchPaso(telefono, ext.textoProcesado, conv, supabase)
      } else {
        await reply(telefono, await buildMainMenu(), supabase)
        await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
      }
  }
}

// ── Motor de reserva inteligente ──────────────────────────────────────────────
// Fusiona lo que ya sabe la conv + lo que acaba de extraer la IA.
// Solo pregunta lo que realmente falta.

async function handleReservar(
  telefono: string,
  ext: ExtractedData,
  conv: ConvRow | null,
  supabase: Supabase
) {
  // Fusionar: el contexto existente tiene prioridad sobre lo recién extraído
  // (el cliente ya confirmó esos datos antes)
  const servicio_nombre = conv?.servicio_nombre ?? ext.servicio ?? null
  const categoria_id    = conv?.categoria_id    ?? ext.categoria_id ?? null
  const fechaISO        = conv?.fecha           ?? null
  const nombre          = conv?.nombre          ?? ext.nombre_cliente ?? null

  // Resolver fecha del texto recién extraído si no había fecha en conv
  let parsedFecha: { fecha: Date; interpreted: string; iso: string } | null = fechaISO
    ? { fecha: new Date(fechaISO), interpreted: formatDate(new Date(fechaISO)), iso: '' }
    : null
  if (!parsedFecha && ext.fecha) {
    const p = parseFlexibleDate(ext.fecha)
    if (p.fecha && !p.error) parsedFecha = { fecha: p.fecha, interpreted: p.interpreted, iso: p.iso }
  }
  // Si dijo hora, intentar combinarla con la fecha para ir directo
  const horaTexto = ext.hora ?? null

  // ── Encontrar el servicio en el catálogo + precio actualizado desde BD ──────
  const svcsBD = await getServicios()
  let svcData = servicio_nombre
    ? svcsBD.find(s => s.nombre.toLowerCase() === servicio_nombre.toLowerCase())
    : null
  if (!svcData && servicio_nombre)
    svcData = svcsBD.find(s => s.nombre.toLowerCase().includes(servicio_nombre.toLowerCase()))

  const svcTipo   = svcData?.tipo_precio    ?? 'valoracion'
  const svcPrec   = svcData?.precio         ?? null
  const svcDesde  = svcData?.precio_desde   ?? null
  const svcDur    = svcData?.duracion_minutos ?? 60
  const svcReqVal = svcData?.requiere_valoracion ?? false

  // ── Decidir qué preguntar ─────────────────────────────────────────────────

  // 1. Sin servicio identificado → mostrar categoría si la hay, si no menú principal
  if (!svcData) {
    if (categoria_id) {
      await setConv(supabase, { telefono, paso: 'seleccion_servicio', categoria_id })
      await reply(telefono, await buildCategoryMenu(categoria_id), supabase)
    } else {
      await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
      await reply(telefono, await buildMainMenu(), supabase)
    }
    return
  }

  // Calcular precio
  let precio = 'Requiere valoración'
  if (svcTipo === 'fijo'  && svcPrec)  precio = formatCurrency(Number(svcPrec))
  if (svcTipo === 'desde' && svcDesde) precio = `Desde ${formatCurrency(Number(svcDesde))}`

  // 2. Sin nombre → verificar BD primero, luego pedir
  if (!nombre) {
    const nombreBD = await buscarNombreCliente(telefono, supabase)
    if (nombreBD) {
      await avanzarConNombreConocido(telefono, nombreBD, {
        telefono, paso: 'solicitar_nombre',
        categoria_id: svcData?.categoria_id ?? null,
        servicio_nombre: svcData!.nombre,
        duracion: svcDur, precio,
        fecha: parsedFecha?.fecha?.toISOString() ?? null,
      }, supabase)
      return
    }
    await setConv(supabase, {
      telefono,
      paso:            'solicitar_nombre',
      categoria_id:    svcData?.categoria_id ?? null,
      servicio_nombre: svcData!.nombre,
      duracion:        svcDur,
      precio,
      fecha:           parsedFecha?.fecha?.toISOString() ?? null,
    })
    const priceMsg = (svcTipo === 'valoracion' || svcReqVal)
      ? '\n\nℹ️ El precio final depende de largo, cantidad y técnica.'
      : `\n\n💵 Precio: *${precio}*  ⏱️ Duración: *${svcDur} min*`
    await reply(telefono, `💅 *${svcData!.nombre}*${priceMsg}\n\n✍️ ¿Cuál es tu *nombre completo*?`, supabase)
    return
  }

  // 3. Sin fecha → pedir fecha
  if (!parsedFecha) {
    await setConv(supabase, {
      telefono,
      paso:            'solicitar_fecha',
      categoria_id:    svcData?.categoria_id ?? null,
      servicio_nombre: svcData!.nombre,
      duracion:        svcDur,
      precio,
      nombre,
    })
    await reply(
      telefono,
      `👋 Hola *${nombre}*!\n\n📅 ¿Qué fecha prefieres para *${svcData!.nombre}*?\n\nEjemplos: *mañana*, *el sábado*, *18/07/2026*`,
      supabase
    )
    return
  }

  // 4. Tenemos servicio + nombre + fecha → buscar especialistas
  // Si el cliente también dijo una hora, intentar match directo con slots
  const baseConv: ConvRow = {
    telefono,
    paso:            'seleccion_especialista',
    categoria_id:    svcData?.categoria_id ?? null,
    servicio_nombre: svcData!.nombre,
    duracion:        svcDur,
    precio,
    nombre,
    fecha:           parsedFecha.fecha.toISOString(),
    especialista_id: null,
  }

  // Si mencionó hora → intentar filtrar slots automáticamente
  if (horaTexto) {
    await setConv(supabase, { ...baseConv, paso: 'seleccion_horario' })
    await tryAutoSlot(telefono, horaTexto, baseConv, supabase)
    return
  }

  await setConv(supabase, baseConv)
  const { data: esps } = await supabase.from('especialistas').select('id, nombre').eq('activo', true).order('nombre')
  await reply(telefono, buildEspecialistaMenu(esps || [], parsedFecha.interpreted), supabase)
}

// ── Intento de match automático de hora con slots ────────────────────────────

async function tryAutoSlot(
  telefono: string,
  horaTexto: string,
  baseConv: ConvRow,
  supabase: Supabase
) {
  const fecha    = new Date(baseConv.fecha!)
  const duracion = baseConv.duracion ?? 60
  const slots    = await getAvailableSlots(fecha, duracion)

  if (!slots.length) {
    await reply(
      telefono,
      `😔 No hay disponibilidad para *${formatDate(fecha)}*.\n\n¿Tienes otra fecha? Escríbela así: *mañana*, *el sábado*, *20/07*`,
      supabase
    )
    await setConv(supabase, { ...baseConv, paso: 'solicitar_fecha' })
    return
  }

  // Intentar match de hora (normalizar "2:00 PM", "las dos", "14:00"…)
  const horaNorm = normalizarHoraTexto(horaTexto)
  const matched  = horaNorm ? slots.filter(s => normalizarHoraTexto(s.hora) === horaNorm) : []

  if (matched.length === 1) {
    // Match exacto → confirmar directo
    await setConv(supabase, { ...baseConv, slots_json: matched, paso: 'seleccion_horario' })
    const s = matched[0]
    await reply(
      telefono,
      `✅ Encontré disponibilidad:\n\n🕒 *${s.hora}* con *${s.especialista_nombre}*\n\n¿Confirmo la cita? Escribe *1* para confirmar o elige otra hora.`,
      supabase
    )
    return
  }

  // Sin match exacto → mostrar menú de horarios completo
  const MAX_SHOW = 20
  const shown    = slots.slice(0, MAX_SHOW)
  await setConv(supabase, { ...baseConv, slots_json: shown, paso: 'seleccion_horario' })
  const extra = slots.length > MAX_SHOW ? `\n_Mostrando ${MAX_SHOW} de ${slots.length}._` : ''
  await reply(telefono, buildHorariosMenu(shown, formatDate(fecha)) + extra, supabase)
}

/** Normaliza textos de hora a "HH:MM" 24h para comparar */
function normalizarHoraTexto(hora: string): string | null {
  if (!hora) return null
  const h = hora.toLowerCase().trim()
  // "2:00 PM" → parse
  const ampm = h.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/)
  if (ampm) {
    let hh = parseInt(ampm[1])
    const mm = parseInt(ampm[2] ?? '0')
    if (ampm[3] === 'pm' && hh < 12) hh += 12
    if (ampm[3] === 'am' && hh === 12) hh = 0
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
  }
  // "14:30"
  const h24 = h.match(/^(\d{1,2}):(\d{2})$/)
  if (h24) return `${String(parseInt(h24[1])).padStart(2,'0')}:${h24[2]}`
  return null
}

// ── Despacho por paso (para números y datos puntuales) ────────────────────────

async function dispatchPaso(telefono: string, text: string, conv: ConvRow, supabase: Supabase) {
  switch (conv.paso) {
    case 'seleccion_categoria':      await handleCatSelection(telefono, text, conv, supabase); break
    case 'seleccion_servicio':       await handleSvcSelection(telefono, text, conv, supabase); break
    case 'solicitar_nombre':         await handleNombre(telefono, text, conv, supabase); break
    case 'solicitar_fecha':          await handleFecha(telefono, text, conv, supabase); break
    case 'seleccion_especialista':   await handleEspecialista(telefono, text, conv, supabase); break
    case 'seleccion_horario':        await handleHorario(telefono, text, conv, supabase); break
    case 'confirmar_cancelacion':    await handleConfirmarCancelacion(telefono, text, conv, supabase); break
    case 'seleccion_cita_cancelar':  await handleSeleccionCitaCancelar(telefono, text, conv, supabase); break
    default:
      await delConv(telefono, supabase)
      await reply(telefono, await buildMainMenu(), supabase)
      await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
  }
}

/**
 * Busca si el teléfono ya tiene un cliente registrado en BD.
 * Normaliza el número antes de buscar para evitar problemas de formato.
 * Retorna { nombre, id } si existe, null si no.
 */
async function buscarCliente(telefono: string, supabase: Supabase): Promise<{ id: string; nombre: string } | null> {
  // Normalizar: quitar todo lo que no sea dígito, luego asegurar prefijo 57
  const digits = telefono.replace(/\D/g, '')
  const normalizado = digits.startsWith('57') && digits.length === 12
    ? digits
    : digits.length === 10 ? `57${digits}` : digits

  // Buscar por número normalizado O por número sin prefijo (tolerancia)
  const sinPrefijo = normalizado.startsWith('57') ? normalizado.slice(2) : normalizado

  const { data } = await supabase
    .from('clientes')
    .select('id, nombre')
    .or(`telefono.eq.${normalizado},telefono.eq.${sinPrefijo},telefono.eq.${telefono}`)
    .order('fecha_registro', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.nombre) return null
  return { id: data.id as string, nombre: data.nombre as string }
}

/**
 * Busca si el teléfono ya tiene un cliente registrado en BD.
 * Retorna solo el nombre (compatibilidad hacia atrás).
 */
async function buscarNombreCliente(telefono: string, supabase: Supabase): Promise<string | null> {
  const cliente = await buscarCliente(telefono, supabase)
  return cliente?.nombre ?? null
}

/**
 * Avanza al paso solicitar_fecha usando el nombre ya conocido.
 * Salta completamente el paso solicitar_nombre.
 */
async function avanzarConNombreConocido(
  telefono: string, nombre: string, conv: ConvRow, supabase: Supabase
) {
  await setConv(supabase, { ...conv, nombre, paso: 'solicitar_fecha' })
  await reply(
    telefono,
    `👋 Hola de nuevo *${nombre}*! 😊\n\n📅 ¿Qué fecha prefieres para tu cita?\n\nEjemplos: *mañana*, *próximo sábado*, *18/07/2026*`,
    supabase
  )
}

async function handleCatSelection(t: string, text: string, conv: ConvRow, sb: Supabase) {
  const cats = await getCategorias()
  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > cats.length) {
    await reply(t, `❌ Escribe un número del *1* al *${cats.length}*.`, sb); return
  }
  const cat = cats[num - 1]
  await setConv(sb, { ...conv, categoria_id: cat.id, paso: 'seleccion_servicio' })
  await reply(t, await buildCategoryMenu(cat.id), sb)
}

async function handleSvcSelection(t: string, text: string, conv: ConvRow, sb: Supabase) {
  // Obtener servicios de la categoría desde Supabase
  const allSvcs = await getServicios()
  const cats    = await getCategorias()

  // Buscar la categoría por ID (puede ser UUID o id local)
  const catBD   = cats.find(c => c.id === conv.categoria_id)
  const catLocal = CATEGORIAS.find(c => c.id === conv.categoria_id)
  const catNombre = catBD?.nombre ?? catLocal?.nombre ?? ''

  const svcs = allSvcs.filter(s =>
    s.categoria_id === conv.categoria_id ||
    s.categoria_nombre?.toLowerCase() === catNombre.toLowerCase()
  ).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > svcs.length) {
    await reply(t, `❌ Escribe un número del *1* al *${svcs.length}*.`, sb); return
  }
  const svc = svcs[num - 1]

  let precio = 'Requiere valoración'
  if (svc.tipo_precio === 'fijo'  && svc.precio)       precio = formatCurrency(Number(svc.precio))
  if (svc.tipo_precio === 'desde' && svc.precio_desde) precio = `Desde ${formatCurrency(Number(svc.precio_desde))}`

  await setConv(sb, { ...conv, servicio_nombre: svc.nombre, duracion: svc.duracion_minutos, precio, paso: 'solicitar_nombre' })

  const priceMsg = (svc.tipo_precio === 'valoracion' || svc.requiere_valoracion)
    ? '\n\nℹ️ Precio según largo, cantidad y técnica.'
    : `\n\n💵 Precio: *${precio}*  ⏱️ Duración: *${svc.duracion_minutos} min*`

  // Verificar si ya conocemos el nombre del cliente
  const nombreConocido = await buscarNombreCliente(t, sb)
  if (nombreConocido) {
    await avanzarConNombreConocido(t, nombreConocido, { ...conv, servicio_nombre: svc.nombre, duracion: svc.duracion_minutos, precio }, sb)
    return
  }
  await reply(t, `💅 *${svc.nombre}*${priceMsg}\n\n✍️ ¿Cuál es tu *nombre completo*?`, sb)
}

async function handleNombre(t: string, text: string, conv: ConvRow, sb: Supabase) {
  if (text.trim().length < 3) { await reply(t, '❌ Escribe tu nombre completo (mínimo 3 letras).', sb); return }
  await setConv(sb, { ...conv, nombre: text.trim(), paso: 'solicitar_fecha' })
  await reply(t, `👋 Hola *${text.trim()}*!\n\n📅 ¿Qué fecha prefieres?\n\nEjemplos: *mañana*, *próximo sábado*, *18/07/2026*`, sb)
}

async function handleFecha(t: string, text: string, conv: ConvRow, sb: Supabase) {
  const p = parseFlexibleDate(text)
  if (!p.fecha || p.error) {
    await reply(t, p.error || '❌ No entendí la fecha. Escribe: *mañana*, *próximo lunes*, *18/07/2026*', sb); return
  }
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  if (p.iso < hoy) { await reply(t, `❌ La fecha *${p.display}* ya pasó. Elige una fecha futura.`, sb); return }

  await setConv(sb, { ...conv, fecha: p.fecha.toISOString(), paso: 'seleccion_especialista' })
  const { data: esps } = await sb.from('especialistas').select('id, nombre').eq('activo', true).order('nombre')
  await reply(t, buildEspecialistaMenu(esps || [], p.interpreted), sb)
}

async function handleEspecialista(t: string, text: string, conv: ConvRow, sb: Supabase) {
  const { data: esps } = await sb.from('especialistas').select('id, nombre').eq('activo', true).order('nombre')
  const lista = esps || []
  const num   = parseInt(text)
  if (isNaN(num) || num < 1 || num > lista.length + 1) {
    await reply(t, `❌ Escribe un número del *1* al *${lista.length + 1}*.`, sb); return
  }
  const espId = num <= lista.length ? lista[num - 1].id : undefined
  await reply(t, '🔍 Buscando horarios disponibles...', sb)

  const slots = await getAvailableSlots(new Date(conv.fecha!), conv.duracion ?? 60, espId)
  if (!slots.length) {
    const nombre = num <= lista.length ? lista[num - 1].nombre : 'ninguna especialista'
    await reply(t, `😔 Sin disponibilidad para *${formatDate(new Date(conv.fecha!))}* con *${nombre}*.\n\n¿Otra fecha?`, sb)
    await setConv(sb, { ...conv, paso: 'solicitar_fecha' }); return
  }
  const MAX = 20
  const shown = slots.slice(0, MAX)
  await setConv(sb, { ...conv, especialista_id: espId ?? null, slots_json: shown, paso: 'seleccion_horario' })
  const extra = slots.length > MAX ? `\n_Mostrando ${MAX} de ${slots.length}._` : ''
  await reply(t, buildHorariosMenu(shown, formatDate(new Date(conv.fecha!))) + extra, sb)
}

async function handleHorario(t: string, text: string, conv: ConvRow, sb: Supabase) {
  const slots = (conv.slots_json as AvailableSlot[] | null) ?? []
  const num   = parseInt(text)
  if (isNaN(num) || num < 1 || num > slots.length) {
    await reply(t, `❌ Escribe un número del *1* al *${slots.length}*.`, sb); return
  }
  const slot = slots[num - 1]

  // ── Validar que el slot no haya pasado (puede ocurrir si el cliente tardó en responder) ──
  const ahoraUTC = new Date()
  const slotInicio = new Date(slot.fecha_inicio)
  if (slotInicio.getTime() <= ahoraUTC.getTime()) {
    await delConv(t, sb)
    // Intentar buscar nuevos slots disponibles ahora
    const nuevosSlots = await getAvailableSlots(
      new Date(conv.fecha!), conv.duracion ?? 60,
      conv.especialista_id ?? undefined
    )
    if (nuevosSlots.length) {
      const MAX = 20
      const shown = nuevosSlots.slice(0, Math.min(MAX, nuevosSlots.length))
      await setConv(sb, { ...conv, slots_json: shown, paso: 'seleccion_horario' })
      await reply(t, `⚠️ Ese horario ya no está disponible.\n\nAquí están los horarios actualizados:\n\n${buildHorariosMenu(shown, formatDate(new Date(conv.fecha!)))}`, sb)
    } else {
      await reply(t, `😔 Ya no hay disponibilidad para hoy.\n\n¿Quieres agendar para otro día? Escribe la fecha, por ejemplo: *mañana*, *el sábado*.`, sb)
      await setConv(sb, { ...conv, paso: 'solicitar_fecha' })
    }
    return
  }

  // Buscar o crear cliente — usando la función centralizada con normalización
  let clienteId = ''
  const clienteExistente = await buscarCliente(t, sb)
  if (clienteExistente) {
    clienteId = clienteExistente.id
  } else {
    // Normalizar teléfono al insertar
    const digits = t.replace(/\D/g, '')
    const telNorm = digits.startsWith('57') && digits.length === 12 ? digits : digits.length === 10 ? `57${digits}` : digits
    const { data: nc } = await sb.from('clientes')
      .insert({ nombre: conv.nombre, telefono: telNorm, fecha_registro: new Date().toISOString() })
      .select('id').single()
    clienteId = nc?.id ?? ''
  }
  if (!clienteId) { await reply(t, '❌ Error al procesar. Escribe *hola* para reintentar.', sb); return }

  const { data: svc } = await sb
    .from('servicios')
    .select('id')
    .ilike('nombre', `%${(conv.servicio_nombre ?? '').trim()}%`)
    .limit(1)
    .maybeSingle()

  // Si no encuentra el servicio, crear la cita de todas formas sin servicio_id
  // para no perder la reserva — se puede corregir manualmente en el panel
  const servicioId = svc?.id ?? null

  const cita = await createAppointment({
    cliente_id: clienteId, especialista_id: slot.especialista_id,
    servicio_id: servicioId, fecha_inicio: slot.fecha_inicio, fecha_fin: slot.fecha_fin,
  })
  if (!cita) {
    await reply(t, '❌ Ese horario ya fue reservado. Escribe *hola* para elegir otro.', sb)
    await delConv(t, sb); return
  }

  await delConv(t, sb)
  const fechaCita = new Date(slot.fecha_inicio)
  await sendAppointmentConfirmation(t, {
    cliente: conv.nombre!, servicio: conv.servicio_nombre!,
    especialista: slot.especialista_nombre, fecha: formatDate(fechaCita),
    hora: slot.hora, precio: conv.precio || 'A definir en la cita',
  })

  const { data: citaFull } = await sb.from('citas')
    .select('*, cliente:clientes(nombre,telefono), servicio:servicios(nombre,duracion_minutos), especialista:especialistas(id,nombre,whatsapp,notificaciones)')
    .eq('id', cita.id).single()
  if (citaFull) notificarEspecialista({ ...citaFull, canal: 'whatsapp' }, sb).catch(() => {})

  try {
    await sb.from('mensajes_whatsapp').insert({
      cliente_id: clienteId, telefono: t,
      mensaje: `✅ Cita: ${conv.servicio_nombre} con ${slot.especialista_nombre} el ${formatDate(fechaCita)} a las ${slot.hora}`,
      tipo: 'sistema', fecha: new Date().toISOString(),
    })
  } catch { /* no bloquear */ }
}

// ── Flujo de cancelación de citas ─────────────────────────────────────────────

/**
 * Punto de entrada para cancelar cita.
 * Busca citas futuras del cliente y presenta opciones.
 */
async function handleCancelarCita(telefono: string, conv: ConvRow | null, supabase: Supabase) {
  // 1. Identificar cliente
  const cliente = await buscarCliente(telefono, supabase)
  if (!cliente) {
    await reply(telefono, '😊 No encontré ningún cliente registrado con tu número.\nEscribe *hola* si deseas agendar una cita nueva.', supabase)
    return
  }

  // 2. Buscar citas futuras con estado confirmada, pendiente o en_proceso
  const ahora = new Date().toISOString()
  const { data: citas } = await supabase
    .from('citas')
    .select('id, fecha_inicio, fecha_fin, servicio:servicios(nombre), especialista:especialistas(nombre)')
    .eq('cliente_id', cliente.id)
    .in('estado', ['confirmada', 'pendiente', 'en_proceso'])
    .gte('fecha_inicio', ahora)
    .order('fecha_inicio', { ascending: true })
    .limit(10)

  if (!citas || citas.length === 0) {
    await reply(telefono, `😊 Hola *${cliente.nombre}*, no tienes citas activas para cancelar.\nSi deseas agendar una nueva, escribe *hola*.`, supabase)
    return
  }

  // Formatear citas para mostrar y guardar en conv
  const citasFormateadas: CitaCancelar[] = citas.map(c => {
    const fechaObj = new Date(c.fecha_inicio)
    return {
      id: c.id,
      servicio: (c.servicio as { nombre?: string } | null)?.nombre ?? 'Servicio',
      especialista: (c.especialista as { nombre?: string } | null)?.nombre ?? 'Especialista',
      fecha_inicio: c.fecha_inicio,
      hora: fechaObj.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' }),
      fecha_display: formatDate(fechaObj),
    }
  })

  if (citasFormateadas.length === 1) {
    // Una sola cita → pedir confirmación directa
    const c = citasFormateadas[0]
    await setConv(supabase, {
      telefono, paso: 'confirmar_cancelacion',
      nombre: cliente.nombre,
      citas_cancelar_json: citasFormateadas,
    })
    await reply(telefono,
      `📋 *Cita encontrada:*\n\n` +
      `💅 Servicio: *${c.servicio}*\n` +
      `👩 Especialista: *${c.especialista}*\n` +
      `📅 Fecha: *${c.fecha_display}*\n` +
      `⏰ Hora: *${c.hora}*\n\n` +
      `¿Deseas cancelar esta cita?\n*1.* Sí, cancelar\n*2.* No, mantenerla`,
      supabase
    )
  } else {
    // Varias citas → mostrar lista
    const lista = citasFormateadas.map((c, i) =>
      `${nb(i+1)} *${c.servicio}* — ${c.hora} · ${c.fecha_display}\n    👩 ${c.especialista}`
    ).join('\n\n')
    await setConv(supabase, {
      telefono, paso: 'seleccion_cita_cancelar',
      nombre: cliente.nombre,
      citas_cancelar_json: citasFormateadas,
    })
    await reply(telefono,
      `📋 *${cliente.nombre}*, tienes ${citasFormateadas.length} citas activas:\n\n${lista}\n\n` +
      `¿Cuál deseas cancelar? Escribe el número.\n_(Escribe *0* para no cancelar ninguna)_`,
      supabase
    )
  }
}

/**
 * Maneja la confirmación "Sí/No" para una sola cita.
 */
async function handleConfirmarCancelacion(telefono: string, text: string, conv: ConvRow, supabase: Supabase) {
  const t = text.toLowerCase().trim()
  const citas = (conv.citas_cancelar_json as CitaCancelar[] | null) ?? []

  // No cancelar
  if (t === '2' || t === 'no' || t === 'no gracias' || t === 'no, mantenerla') {
    await delConv(telefono, supabase)
    await reply(telefono, '✅ Perfecto, tu cita sigue activa. ¡Te esperamos! 💖', supabase)
    return
  }

  // Confirmar cancelación
  if (t === '1' || t === 'sí' || t === 'si' || t === 'confirmar' || t === 'cancelar' || t === 'yes') {
    if (!citas.length) {
      await delConv(telefono, supabase)
      await reply(telefono, '❌ No encontré la cita. Escribe *hola* para reintentar.', supabase)
      return
    }
    await ejecutarCancelacion(telefono, citas[0], conv.nombre ?? '', supabase)
    return
  }

  // Respuesta no reconocida
  await reply(telefono, '❓ Por favor responde *1* para cancelar o *2* para mantener tu cita.', supabase)
}

/**
 * Maneja la selección de cuál cita cancelar cuando hay varias.
 */
async function handleSeleccionCitaCancelar(telefono: string, text: string, conv: ConvRow, supabase: Supabase) {
  const citas = (conv.citas_cancelar_json as CitaCancelar[] | null) ?? []
  const num = parseInt(text.trim())

  if (num === 0 || text.toLowerCase() === 'no' || text.toLowerCase() === 'ninguna') {
    await delConv(telefono, supabase)
    await reply(telefono, '✅ Entendido, no se canceló ninguna cita. ¡Te esperamos! 💖', supabase)
    return
  }

  if (isNaN(num) || num < 1 || num > citas.length) {
    await reply(telefono, `❌ Escribe un número del *1* al *${citas.length}*, o *0* para no cancelar ninguna.`, supabase)
    return
  }

  const citaSeleccionada = citas[num - 1]
  // Pedir confirmación antes de cancelar
  await setConv(supabase, { ...conv, paso: 'confirmar_cancelacion', citas_cancelar_json: [citaSeleccionada] })
  await reply(telefono,
    `📋 *Confirmar cancelación:*\n\n` +
    `💅 *${citaSeleccionada.servicio}*\n` +
    `👩 ${citaSeleccionada.especialista}\n` +
    `📅 ${citaSeleccionada.fecha_display} · ⏰ ${citaSeleccionada.hora}\n\n` +
    `¿Confirmas la cancelación?\n*1.* Sí, cancelar\n*2.* No, mantenerla`,
    supabase
  )
}

/**
 * Ejecuta la cancelación en Supabase y notifica al cliente.
 */
async function ejecutarCancelacion(
  telefono: string,
  cita: CitaCancelar,
  nombreCliente: string,
  supabase: Supabase
) {
  const ahora = new Date().toISOString()

  const { error } = await supabase
    .from('citas')
    .update({
      estado: 'cancelada',
      updated_at: ahora,
    })
    .eq('id', cita.id)
    .in('estado', ['confirmada', 'pendiente', 'en_proceso']) // solo cancela si aún está activa

  if (error) {
    console.error('[Cancelar cita] Error:', error)
    await reply(telefono, '❌ Ocurrió un error al cancelar tu cita. Por favor contáctanos directamente.', supabase)
    return
  }

  // Registrar en mensajes para auditoría
  try {
    await supabase.from('mensajes_whatsapp').insert({
      telefono,
      mensaje: `❌ Cita cancelada por cliente: ${cita.servicio} con ${cita.especialista} el ${cita.fecha_display} a las ${cita.hora}`,
      tipo: 'sistema',
      fecha: ahora,
    })
  } catch { /* no bloquear */ }

  await delConv(telefono, supabase)
  await reply(telefono,
    `✅ *Cita cancelada exitosamente*\n\n` +
    `💅 Servicio: *${cita.servicio}*\n` +
    `👩 Especialista: *${cita.especialista}*\n` +
    `📅 ${cita.fecha_display} · ⏰ ${cita.hora}\n\n` +
    `Lamentamos que no puedas asistir, *${nombreCliente}*. ¡Esperamos verte pronto! 💖\n\n` +
    `Si deseas agendar una nueva cita, escribe *hola*.`,
    supabase
  )
}

// ── Helpers de precio ─────────────────────────────────────────────────────────

async function buildPrecioResponse(svcNombre?: string | null, catId?: string | null): Promise<string> {
  const svcsBD = await getServicios()

  if (svcNombre) {
    // Buscar primero en BD, luego en local
    const fromBD = svcsBD.find(x => x.nombre.toLowerCase() === svcNombre.toLowerCase())
    const s = fromBD ?? SERVICIOS_DATA.find(x => x.nombre.toLowerCase() === svcNombre.toLowerCase())
    if (s) {
      const tipo  = (fromBD?.tipo_precio ?? ('tipo' in s ? s.tipo : 'valoracion')) as string
      const prec  = fromBD?.precio       ?? ('precio' in s ? s.precio : null)
      const desde = fromBD?.precio_desde ?? ('precio_desde' in s ? s.precio_desde : null)
      const dur   = fromBD?.duracion_minutos ?? ('duracion' in s ? s.duracion : 0)
      let p = 'requiere valoración presencial'
      if (tipo === 'fijo'  && prec)  p = `*${formatCurrency(Number(prec))}*`
      if (tipo === 'desde' && desde) p = `desde *${formatCurrency(Number(desde))}*`
      return `💅 *${s.nombre}*\n💵 Precio: ${p}\n⏱️ Duración: ${dur} min`
    }
  }
  if (catId) {
    const cat      = CATEGORIAS.find(c => c.id === catId)
    const svcsLocal = SERVICIOS_DATA.filter(s => s.cat === catId)
    const list = svcsLocal.map(s => {
      const fromBD = svcsBD.find(b => b.nombre.toLowerCase() === s.nombre.toLowerCase())
      const tipo   = fromBD?.tipo_precio ?? s.tipo
      const prec   = fromBD?.precio       ?? ('precio' in s ? s.precio : null)
      const desde  = fromBD?.precio_desde ?? ('precio_desde' in s ? s.precio_desde : null)
      let p = ''
      if (tipo === 'fijo'  && prec)  p = ` — $${Number(prec).toLocaleString('es-CO')}`
      if (tipo === 'desde' && desde) p = ` — desde $${Number(desde).toLocaleString('es-CO')}`
      return `• ${s.nombre}${p}`
    }).join('\n')
    return `${cat?.icono ?? '💅'} *Precios — ${cat?.nombre ?? 'Servicios'}*\n\n${list}`
  }
  return '💵 Dime el servicio que te interesa y te digo el precio 😊'
}

// ── Helper reply ──────────────────────────────────────────────────────────────

async function reply(telefono: string, message: string, supabase: Supabase) {
  sendWhatsAppMessage(telefono, message).catch(e =>
    console.error(`[WA send failed ${telefono}]:`, e?.message)
  )
  try {
    await supabase.from('mensajes_whatsapp').insert({
      telefono, mensaje: message, tipo: 'saliente', fecha: new Date().toISOString(),
    })
  } catch { /* no bloquear */ }
}



/**
 * Motor del bot de WhatsApp — Claudia Agudelo Beauty
 * Migrado desde el SPA (src/app/api/whatsapp/webhook/route.ts)
 * Usa Dualhook + Cloud API en lugar de Evolution API.
 * Trabaja sobre la misma base de datos Supabase del SPA.
 */
import { getSupabase } from '../database/supabase'
import { sendText } from './whatsapp.service'
import { chat } from './openai.service'
import { webhookLog } from '../config/logger'

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

interface AvailableSlot {
  fecha_inicio:      string
  fecha_fin:         string
  hora:              string
  especialista_id:   string
  especialista_nombre: string
}

interface SvcDB {
  id?: string
  nombre: string
  tipo_precio: string
  precio?: number | null
  precio_desde?: number | null
  duracion_minutos: number
  categoria_id?: string
  categoria_nombre?: string
  requiere_valoracion?: boolean
}

interface CatDB { id: string; nombre: string; icono: string; orden: number }

// ── Cache de catalogo ─────────────────────────────────────────────────────────

let _svcsCache: SvcDB[] | null = null
let _catsCache: CatDB[] | null = null
let _svcsExpiry = 0
let _catsExpiry = 0

async function getCategorias(): Promise<CatDB[]> {
  if (_catsCache && Date.now() < _catsExpiry) return _catsCache
  const sb = getSupabase()
  const { data } = await sb.from('categorias').select('*').order('orden')
  if (data?.length) {
    _catsCache = data as CatDB[]
    _catsExpiry = Date.now() + 10 * 60 * 1000
    return _catsCache
  }
  _catsCache = []
  _catsExpiry = Date.now() + 60 * 1000
  return []
}

async function getServicios(): Promise<SvcDB[]> {
  if (_svcsCache && Date.now() < _svcsExpiry) return _svcsCache
  const sb = getSupabase()
  const { data } = await sb
    .from('servicios')
    .select('id, nombre, tipo_precio, precio, precio_desde, duracion_minutos, categoria_id, requiere_valoracion, categoria:categorias(nombre)')
    .eq('activo', true).order('nombre')
  if (data?.length) {
    _svcsCache = data.map((s: Record<string, unknown>) => ({
      ...s,
      categoria_nombre: (s.categoria as { nombre?: string } | null)?.nombre ?? '',
    })) as SvcDB[]
    _svcsExpiry = Date.now() + 5 * 60 * 1000
    return _svcsCache
  }
  return []
}

// ── Helpers de conversacion ───────────────────────────────────────────────────

async function getConv(telefono: string): Promise<ConvRow | null> {
  const sb = getSupabase()
  await sb.from('conversaciones_bot').delete()
    .lt('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
  const { data } = await sb.from('conversaciones_bot').select('*').eq('telefono', telefono).maybeSingle()
  return data as ConvRow | null
}

async function setConv(row: ConvRow): Promise<void> {
  await getSupabase().from('conversaciones_bot').upsert(row, { onConflict: 'telefono' })
}

async function delConv(telefono: string): Promise<void> {
  await getSupabase().from('conversaciones_bot').delete().eq('telefono', telefono)
}

async function reply(telefono: string, message: string): Promise<void> {
  webhookLog.info({ telefono, preview: message.slice(0, 80) }, '[BotEngine] 📤 Enviando respuesta al cliente')
  sendText({ to: telefono, text: message }).catch(e =>
    webhookLog.error({ err: (e as Error).message, stack: (e as Error).stack }, '[BotEngine] ❌ Error enviando mensaje por WhatsApp')
  )
  try {
    await getSupabase().from('mensajes_whatsapp').insert({
      telefono, mensaje: message, tipo: 'saliente', fecha: new Date().toISOString(),
    })
  } catch { /* no bloquear */ }
}

// ── Buscar cliente ────────────────────────────────────────────────────────────

async function buscarCliente(telefono: string): Promise<{ id: string; nombre: string } | null> {
  const digits = telefono.replace(/\D/g, '')
  const normalizado = digits.startsWith('57') && digits.length === 12
    ? digits : digits.length === 10 ? `57${digits}` : digits
  const sinPrefijo = normalizado.startsWith('57') ? normalizado.slice(2) : normalizado
  const { data } = await getSupabase().from('clientes').select('id, nombre')
    .or(`telefono.eq.${normalizado},telefono.eq.${sinPrefijo},telefono.eq.${telefono}`)
    .order('fecha_registro', { ascending: false }).limit(1).maybeSingle()
  if (!data?.nombre) return null
  return { id: data.id as string, nombre: data.nombre as string }
}

// ── Construir menus ───────────────────────────────────────────────────────────

function nb(i: number) { return `*${i}.*` }

async function buildMainMenu(): Promise<string> {
  const cats = await getCategorias()
  const items = cats.map((c, i) => `${nb(i + 1)} ${c.icono} ${c.nombre}`).join('\n')
  return `🌸 *CLAUDIA AGUDELO BEAUTY*\n\n¡Hola! 😊 Sera un gusto atenderte.\n\nSelecciona una categoria:\n\n${items}\n\n_Escribe el numero de tu opcion._`
}

async function buildCategoryMenu(catId: string): Promise<string> {
  const cats = await getCategorias()
  const svcs = await getServicios()
  const cat = cats.find(c => c.id === catId)
  if (!cat) return '❌ Categoria no encontrada.'
  const serviciosCat = svcs.filter(s =>
    s.categoria_id === cat.id || s.categoria_nombre?.toLowerCase() === cat.nombre.toLowerCase()
  ).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  if (!serviciosCat.length) return `${cat.icono} *${cat.nombre.toUpperCase()}*\n\nNo hay servicios disponibles.`
  const items = serviciosCat.map((s, i) => {
    let p = ''
    if (s.tipo_precio === 'fijo' && s.precio) p = `  ·  $${Number(s.precio).toLocaleString('es-CO')}`
    if (s.tipo_precio === 'desde' && s.precio_desde) p = `  ·  desde $${Number(s.precio_desde).toLocaleString('es-CO')}`
    return `${nb(i + 1)} ${s.nombre}${p}`
  }).join('\n')
  return `${cat.icono} *${cat.nombre.toUpperCase()}*\n\n${items}\n\n_Escribe el numero del servicio deseado._`
}

function buildEspecialistaMenu(esps: Array<{ id: string; nombre: string }>, fecha: string): string {
  const items = esps.map((e, i) => `${nb(i + 1)} ${e.nombre}`).join('\n')
  return `📅 Fecha confirmada: *${fecha}* ✅\n\n👩 *¿Con que especialista prefieres tu cita?*\n\n${items}\n${nb(esps.length + 1)} Cualquiera disponible\n\n_Escribe el numero de tu opcion._`
}

function buildHorariosMenu(slots: AvailableSlot[], fDisplay: string): string {
  const items = slots.map((s, i) => `${nb(i + 1)} *${s.hora}*  ·  ${s.especialista_nombre}`).join('\n')
  return `🕒 *HORARIOS DISPONIBLES*\n📅 ${fDisplay}\n\n${items}\n\n_Escribe el numero del horario que prefieres._`
}

// ── Formato de fechas ─────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}

// ── Slots disponibles ─────────────────────────────────────────────────────────

async function getAvailableSlots(fecha: Date, duracion: number, espId?: string): Promise<AvailableSlot[]> {
  const sb = getSupabase()
  const fechaStr = fecha.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const { data: esps } = await sb.from('especialistas').select('id, nombre, horario_inicio, horario_fin, dias_trabajo')
    .eq('activo', true).order('nombre')
  if (!esps?.length) return []

  const slots: AvailableSlot[] = []
  const espsFiltradas = espId ? esps.filter((e: Record<string, unknown>) => e.id === espId) : esps

  for (const esp of espsFiltradas) {
    const inicio = (esp.horario_inicio as string) ?? '09:00'
    const fin    = (esp.horario_fin    as string) ?? '19:00'
    const [hf, mf] = fin.split(':').map(Number)

    const { data: citasOcupadas } = await sb.from('citas').select('fecha_inicio, fecha_fin')
      .eq('especialista_id', esp.id).in('estado', ['confirmada', 'en_proceso'])
      .gte('fecha_inicio', `${fechaStr}T00:00:00-05:00`)
      .lte('fecha_inicio', `${fechaStr}T23:59:59-05:00`)

    let cursor = new Date(`${fechaStr}T${inicio}:00-05:00`)
    const endTime = new Date(`${fechaStr}T${String(hf).padStart(2,'0')}:${String(mf).padStart(2,'0')}:00-05:00`)

    while (cursor.getTime() + duracion * 60000 <= endTime.getTime()) {
      const slotFin = new Date(cursor.getTime() + duracion * 60000)
      const ocupado = (citasOcupadas ?? []).some((c: Record<string, unknown>) => {
        const ci = new Date(c.fecha_inicio as string).getTime()
        const cf = new Date(c.fecha_fin   as string).getTime()
        return cursor.getTime() < cf && slotFin.getTime() > ci
      })
      if (!ocupado) {
        const hora = cursor.toLocaleTimeString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true })
        slots.push({
          fecha_inicio:       cursor.toISOString(),
          fecha_fin:          slotFin.toISOString(),
          hora,
          especialista_id:    esp.id as string,
          especialista_nombre: esp.nombre as string,
        })
      }
      cursor = new Date(cursor.getTime() + 30 * 60000)
    }
  }
  return slots
}

async function createAppointment(data: {
  cliente_id: string; especialista_id: string; servicio_id: string | null
  fecha_inicio: string; fecha_fin: string
}): Promise<{ id: string } | null> {
  const sb = getSupabase()
  const { data: cita, error } = await sb.from('citas').insert({
    ...data, estado: 'confirmada', canal: 'whatsapp',
  }).select('id').single()
  if (error) { webhookLog.error({ err: error.message }, '[Bot] Error creando cita'); return null }
  return cita as { id: string }
}

// ── Parseo de fecha en español — parser completo ─────────────────────────────

const MESES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  // abreviaciones
  ene: 0, feb: 1, mar: 2, abr: 3, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
}

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6,
}

function hoyBogota(): Date {
  // Fecha actual en zona America/Bogota sin horas
  const str = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface ParseResult {
  fecha: Date | null
  display: string       // "lunes 10 de agosto de 2026"
  iso: string           // "2026-08-10"
  confirmMsg: string    // Mensaje que el bot envía para confirmar
  error?: string
  ambigua?: boolean     // true si necesita confirmación explícita
}

function parseFlexibleDate(texto: string): ParseResult {
  const hoy = hoyBogota()
  const t = texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar tildes para comparar
    .trim()

  const toISO = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const toDisplay = (d: Date) => formatDate(d)
  const ok = (d: Date, ambigua = false): ParseResult => {
    const iso = toISO(d)
    const display = toDisplay(d)
    const confirmMsg = `📅 Entendí que quieres cita para el *${display}*. ¿Es correcto? (escribe *sí* para confirmar o la fecha correcta)`
    return { fecha: d, display, iso, confirmMsg, ambigua }
  }
  const err = (msg: string): ParseResult => ({
    fecha: null, display: '', iso: '', confirmMsg: '',
    error: msg,
  })

  // ── Relativos simples ──────────────────────────────────────────────────
  if (t === 'hoy') return ok(hoy)

  if (t === 'manana' || t === 'mañana') {
    const d = new Date(hoy); d.setDate(d.getDate() + 1)
    return ok(d)
  }

  if (t === 'pasado manana' || t === 'pasado mañana') {
    const d = new Date(hoy); d.setDate(d.getDate() + 2)
    return ok(d)
  }

  // ── "la próxima semana" / "la semana que viene" ────────────────────────
  if (t.includes('proxima semana') || t.includes('semana que viene') || t.includes('siguiente semana')) {
    // Lunes de la próxima semana
    const d = new Date(hoy)
    const dow = d.getDay() // 0=dom
    const diffToNextMonday = dow === 0 ? 1 : 8 - dow
    d.setDate(d.getDate() + diffToNextMonday)
    return ok(d)
  }

  // ── Días de la semana ──────────────────────────────────────────────────
  // Detectar "próximo X", "el X", "este X", "el X 14"
  const esProximo = t.includes('proximo') || t.includes('siguiente') || t.includes('que viene')
  for (const [nombreDia, numDia] of Object.entries(DIAS_SEMANA)) {
    if (!t.includes(nombreDia)) continue

    // Intentar extraer número de día concreto: "el viernes 14"
    const matchNum = t.match(/\b(\d{1,2})\b/)
    if (matchNum) {
      const dia = parseInt(matchNum[1])
      // Buscar en los próximos 60 días una fecha que sea ese día de semana y ese número
      for (let i = 1; i <= 60; i++) {
        const d = new Date(hoy); d.setDate(hoy.getDate() + i)
        if (d.getDay() === numDia && d.getDate() === dia) return ok(d)
      }
    }

    // Sin número: calcular próxima ocurrencia
    const d = new Date(hoy)
    let diff = numDia - d.getDay()
    if (diff <= 0 || esProximo) diff += 7  // "próximo" siempre la semana siguiente
    if (diff === 0) diff = 7               // mismo día → siguiente semana
    d.setDate(d.getDate() + diff)
    return ok(d, esProximo ? false : true) // ambigua si no dijo "próximo"
  }

  // ── "X de MES" / "X MES" / "el X de MES" ─────────────────────────────
  // Ej: "10 de agosto", "agosto 10", "el 10 agosto", "10 ago"
  for (const [nombreMes, numMes] of Object.entries(MESES)) {
    const patterns = [
      new RegExp(`\\b(\\d{1,2})\\s+de\\s+${nombreMes}\\b`),   // "10 de agosto"
      new RegExp(`\\b(\\d{1,2})\\s+${nombreMes}\\b`),          // "10 agosto"
      new RegExp(`\\b${nombreMes}\\s+(\\d{1,2})\\b`),          // "agosto 10"
    ]
    for (const pat of patterns) {
      const m = t.match(pat)
      if (m) {
        const dia = parseInt(m[1])
        const anio = hoy.getFullYear()
        const d = new Date(anio, numMes, dia)
        if (isNaN(d.getTime()) || dia < 1 || dia > 31) return err('❌ Fecha inválida.')
        // Si la fecha ya pasó, asumir el año siguiente
        if (d < hoy) d.setFullYear(anio + 1)
        return ok(d)
      }
    }
  }

  // ── DD/MM/YYYY, DD-MM-YYYY, DD/MM, DD-MM ──────────────────────────────
  const matchNum = t.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/)
  if (matchNum) {
    const dia   = parseInt(matchNum[1])
    const mes   = parseInt(matchNum[2]) - 1  // formato DD/MM → mes es el segundo
    const anio  = matchNum[3] ? parseInt(matchNum[3]) : hoy.getFullYear()
    const d = new Date(anio, mes, dia)
    if (isNaN(d.getTime()) || dia < 1 || dia > 31 || mes < 0 || mes > 11) {
      return err('❌ Fecha inválida. Escribe en formato DD/MM/YYYY, ej: *10/08/2026*')
    }
    if (d < hoy) d.setFullYear(anio + 1)
    return ok(d, true) // siempre confirmar formato numérico — puede confundirse día/mes
  }

  return err('❌ No entendí la fecha 😊\nEscribe algo como: *mañana*, *el viernes*, *10 de agosto*, *10/08*')
}

async function extractIntent(texto: string, conv: ConvRow | null): Promise<{
  intencion: string; servicio: string | null; categoria_id: string | null
  fecha: string | null; hora: string | null; nombre_cliente: string | null; textoProcesado: string
}> {
  const cats = await getCategorias()
  const catalogoStr = cats.map(c => `cat_id=${c.id} "${c.nombre}"`).join(', ')

  const system = `Eres la recepcionista virtual de "Claudia Agudelo Beauty" (spa/salon, Colombia).
Analiza el mensaje y devuelve JSON con:
- intencion: reservar | ver_servicios | ver_categorias | consultar_precio | cancelar_cita | hablar_asesor | saludo | agradecimiento | despedida | dato_puntual | desconocido
- servicio: nombre exacto o null
- categoria_id: id de categoria o null. Categorias: ${catalogoStr}
- fecha: texto natural ("manana", "el sabado") o null
- hora: texto ("2:00 PM") o null
- nombre_cliente: nombre si lo dijo o null
- textoProcesado: texto corregido ortograficamente
Paso actual: ${conv?.paso ?? 'inicio'}. Solo JSON, sin markdown.`

  webhookLog.info({ texto, paso: conv?.paso ?? 'inicio' }, '[BotEngine] 🧠 Llamando a OpenAI para extraer intención')
  const result = await chat({
    messages: [{ role: 'system', content: system }, { role: 'user', content: texto }],
    temperature: 0, maxTokens: 200,
  })
  webhookLog.info({ ok: result.ok, text: result.text, errorMessage: result.errorMessage }, '[BotEngine] 🧠 Respuesta OpenAI recibida')

  if (!result.ok || !result.text) return { intencion: 'dato_puntual', servicio: null, categoria_id: null, fecha: null, hora: null, nombre_cliente: null, textoProcesado: texto }

  try {
    const p = JSON.parse(result.text)
    return {
      intencion:      p.intencion      ?? 'dato_puntual',
      servicio:       p.servicio       ?? null,
      categoria_id:   p.categoria_id   ?? null,
      fecha:          p.fecha          ?? null,
      hora:           p.hora           ?? null,
      nombre_cliente: p.nombre_cliente ?? null,
      textoProcesado: p.textoProcesado ?? texto,
    }
  } catch {
    return { intencion: 'dato_puntual', servicio: null, categoria_id: null, fecha: null, hora: null, nombre_cliente: null, textoProcesado: texto }
  }
}

// ── Motor principal ───────────────────────────────────────────────────────────

export async function processBotMessage(telefono: string, texto: string): Promise<void> {
  const sb = getSupabase()

  webhookLog.info({ telefono, texto }, '[BotEngine] 🤖 Iniciando processBotMessage')

  try {
    await sb.from('mensajes_whatsapp').insert({ telefono, mensaje: texto, tipo: 'entrante', fecha: new Date().toISOString() })
    webhookLog.debug({ telefono }, '[BotEngine] Mensaje entrante guardado en mensajes_whatsapp')
  } catch (e) {
    webhookLog.warn({ err: (e as Error).message }, '[BotEngine] No se pudo guardar mensaje entrante en BD')
  }

  const conv = await getConv(telefono)
  webhookLog.info({ telefono, paso: conv?.paso ?? 'sin_conv' }, '[BotEngine] Estado conversacion actual')
  const lower = texto.toLowerCase().trim()
  const resetWords = ['hola','buenas','buenos dias','buenos días','buenas tardes','buenas noches','inicio','menu','menú','hi','hello','0','reiniciar']

  // Reinicio forzado
  if (resetWords.includes(lower)) {
    webhookLog.info({ telefono, lower }, '[BotEngine] Palabra de reinicio detectada — mostrando menú principal')
    await delConv(telefono)
    const cliente = await buscarCliente(telefono)
    const menu = await buildMainMenu()
    if (cliente) {
      await reply(telefono, `👋 ¡Hola de nuevo, *${cliente.nombre}*! 💖\nQue gusto tenerte por aca.\n\n${menu}`)
    } else {
      await reply(telefono, menu)
    }
    await setConv({ telefono, paso: 'seleccion_categoria', nombre: cliente?.nombre ?? null })
    webhookLog.info({ telefono }, '[BotEngine] ✅ Menú principal enviado')
    return
  }

  // Numero directo si hay conversacion activa
  if (conv && /^\d{1,2}$/.test(texto.trim())) {
    await dispatchPaso(telefono, texto.trim(), conv)
    return
  }

  // IA para cualquier otro texto
  const ext = await extractIntent(texto, conv)
  webhookLog.info({ telefono, intencion: ext.intencion }, '[Bot] Intencion detectada')

  switch (ext.intencion) {
    case 'saludo':
    case 'ver_categorias': {
      await delConv(telefono)
      const cliente = await buscarCliente(telefono)
      const menu = await buildMainMenu()
      if (cliente && ext.intencion === 'saludo') {
        await reply(telefono, `👋 ¡Hola de nuevo, *${cliente.nombre}*! 💖\n\n${menu}`)
      } else {
        await reply(telefono, menu)
      }
      await setConv({ telefono, paso: 'seleccion_categoria', nombre: cliente?.nombre ?? null })
      return
    }
    case 'ver_servicios':
      if (ext.categoria_id) {
        await setConv({ telefono, paso: 'seleccion_servicio', categoria_id: ext.categoria_id })
        await reply(telefono, await buildCategoryMenu(ext.categoria_id))
      } else {
        await reply(telefono, await buildMainMenu())
        await setConv({ telefono, paso: 'seleccion_categoria' })
      }
      return
    case 'cancelar_cita':
      await reply(telefono, '🔄 Para cancelar tu cita escribenos directamente.\nO escribe *hola* para hacer una nueva reserva.')
      return
    case 'hablar_asesor':
      await reply(telefono, '👩 Con gusto te comunico con una asesora.\nEn un momento te atendemos 😊')
      return
    case 'agradecimiento':
    case 'despedida':
      await delConv(telefono)
      await reply(telefono, '¡Con mucho gusto! 💖\nFue un placer atenderte.\nEn *Claudia Agudelo Beauty* siempre tenemos un espacio para ti. ✨')
      return
    case 'reservar':
      await handleReservar(telefono, ext, conv)
      return
    default:
      if (conv) await dispatchPaso(telefono, ext.textoProcesado, conv)
      else { await reply(telefono, await buildMainMenu()); await setConv({ telefono, paso: 'seleccion_categoria' }) }
  }
}

// ── Flujo de reserva ──────────────────────────────────────────────────────────

async function handleReservar(telefono: string, ext: { servicio: string | null; categoria_id: string | null; fecha: string | null; hora: string | null; nombre_cliente: string | null }, conv: ConvRow | null): Promise<void> {
  const svcs = await getServicios()
  const svcData = ext.servicio
    ? (svcs.find(s => s.nombre.toLowerCase() === ext.servicio!.toLowerCase()) ?? svcs.find(s => s.nombre.toLowerCase().includes(ext.servicio!.toLowerCase())))
    : null

  if (!svcData) {
    if (ext.categoria_id) {
      await setConv({ telefono, paso: 'seleccion_servicio', categoria_id: ext.categoria_id })
      await reply(telefono, await buildCategoryMenu(ext.categoria_id))
    } else {
      await setConv({ telefono, paso: 'seleccion_categoria' })
      await reply(telefono, await buildMainMenu())
    }
    return
  }

  let precio = 'Requiere valoracion'
  if (svcData.tipo_precio === 'fijo'  && svcData.precio)       precio = formatCurrency(Number(svcData.precio))
  if (svcData.tipo_precio === 'desde' && svcData.precio_desde) precio = `Desde ${formatCurrency(Number(svcData.precio_desde))}`

  const nombre = conv?.nombre ?? ext.nombre_cliente ?? null
  if (!nombre) {
    const cliente = await buscarCliente(telefono)
    if (cliente) {
      await setConv({ telefono, paso: 'solicitar_fecha', servicio_nombre: svcData.nombre, duracion: svcData.duracion_minutos, precio, nombre: cliente.nombre })
      await reply(telefono, `👋 Hola de nuevo *${cliente.nombre}*! 😊\n\n📅 ¿Que fecha prefieres para *${svcData.nombre}*?\n\nEjemplos: *manana*, *el sabado*, *18/07/2026*`)
      return
    }
    await setConv({ telefono, paso: 'solicitar_nombre', servicio_nombre: svcData.nombre, duracion: svcData.duracion_minutos, precio })
    const priceMsg = svcData.tipo_precio === 'valoracion' ? '\n\nℹ️ El precio final depende de largo, cantidad y tecnica.' : `\n\n💵 Precio: *${precio}*  ⏱️ Duracion: *${svcData.duracion_minutos} min*`
    await reply(telefono, `💅 *${svcData.nombre}*${priceMsg}\n\n✍️ ¿Cual es tu *nombre completo*?`)
    return
  }

  let parsedFecha: { fecha: Date; display: string } | null = null
  if (conv?.fecha) parsedFecha = { fecha: new Date(conv.fecha), display: formatDate(conv.fecha) }
  else if (ext.fecha) {
    const p = parseFlexibleDate(ext.fecha)
    if (p.fecha) parsedFecha = { fecha: p.fecha, display: p.display }
  }

  if (!parsedFecha) {
    await setConv({ telefono, paso: 'solicitar_fecha', servicio_nombre: svcData.nombre, duracion: svcData.duracion_minutos, precio, nombre })
    await reply(telefono, `👋 Hola *${nombre}*!\n\n📅 ¿Que fecha prefieres para *${svcData.nombre}*?\n\nEjemplos: *manana*, *el sabado*, *18/07/2026*`)
    return
  }

  const { data: esps } = await getSupabase().from('especialistas').select('id, nombre').eq('activo', true).order('nombre')
  await setConv({ telefono, paso: 'seleccion_especialista', servicio_nombre: svcData.nombre, duracion: svcData.duracion_minutos, precio, nombre, fecha: parsedFecha.fecha.toISOString() })
  await reply(telefono, buildEspecialistaMenu((esps ?? []) as { id: string; nombre: string }[], parsedFecha.display))
}

// ── Despacho por paso ─────────────────────────────────────────────────────────

async function dispatchPaso(telefono: string, text: string, conv: ConvRow): Promise<void> {
  switch (conv.paso) {
    case 'seleccion_categoria':    await handleCatSelection(telefono, text, conv); break
    case 'seleccion_servicio':     await handleSvcSelection(telefono, text, conv); break
    case 'solicitar_nombre':       await handleNombre(telefono, text, conv); break
    case 'solicitar_fecha':        await handleFecha(telefono, text, conv); break
    case 'confirmar_fecha':        await handleFecha(telefono, text, conv); break
    case 'seleccion_especialista': await handleEspecialista(telefono, text, conv); break
    case 'seleccion_horario':      await handleHorario(telefono, text, conv); break
    default:
      await delConv(telefono)
      await reply(telefono, await buildMainMenu())
      await setConv({ telefono, paso: 'seleccion_categoria' })
  }
}

async function handleCatSelection(t: string, text: string, conv: ConvRow): Promise<void> {
  const cats = await getCategorias()
  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > cats.length) { await reply(t, `❌ Escribe un numero del *1* al *${cats.length}*.`); return }
  const cat = cats[num - 1]
  await setConv({ ...conv, categoria_id: cat.id, paso: 'seleccion_servicio' })
  await reply(t, await buildCategoryMenu(cat.id))
}

async function handleSvcSelection(t: string, text: string, conv: ConvRow): Promise<void> {
  const svcs = await getServicios()
  const cats = await getCategorias()
  const catBD = cats.find(c => c.id === conv.categoria_id)
  const catNombre = catBD?.nombre ?? ''
  const lista = svcs.filter(s => s.categoria_id === conv.categoria_id || s.categoria_nombre?.toLowerCase() === catNombre.toLowerCase())
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > lista.length) { await reply(t, `❌ Escribe un numero del *1* al *${lista.length}*.`); return }
  const svc = lista[num - 1]
  let precio = 'Requiere valoracion'
  if (svc.tipo_precio === 'fijo'  && svc.precio)       precio = formatCurrency(Number(svc.precio))
  if (svc.tipo_precio === 'desde' && svc.precio_desde) precio = `Desde ${formatCurrency(Number(svc.precio_desde))}`

  const cliente = await buscarCliente(t)
  if (cliente) {
    await setConv({ ...conv, servicio_nombre: svc.nombre, duracion: svc.duracion_minutos, precio, nombre: cliente.nombre, paso: 'solicitar_fecha' })
    await reply(t, `👋 Hola de nuevo *${cliente.nombre}*! 😊\n\n📅 ¿Que fecha prefieres para *${svc.nombre}*?`)
    return
  }
  await setConv({ ...conv, servicio_nombre: svc.nombre, duracion: svc.duracion_minutos, precio, paso: 'solicitar_nombre' })
  const priceMsg = svc.tipo_precio === 'valoracion' ? '\n\nℹ️ Precio segun largo, cantidad y tecnica.' : `\n\n💵 Precio: *${precio}*  ⏱️ Duracion: *${svc.duracion_minutos} min*`
  await reply(t, `💅 *${svc.nombre}*${priceMsg}\n\n✍️ ¿Cual es tu *nombre completo*?`)
}

async function handleNombre(t: string, text: string, conv: ConvRow): Promise<void> {
  if (text.trim().length < 3) { await reply(t, '❌ Escribe tu nombre completo (minimo 3 letras).'); return }
  await setConv({ ...conv, nombre: text.trim(), paso: 'solicitar_fecha' })
  await reply(t, `👋 Hola *${text.trim()}*!\n\n📅 ¿Que fecha prefieres?\n\nEjemplos: *manana*, *el sabado*, *18/07/2026*`)
}

async function handleFecha(t: string, text: string, conv: ConvRow): Promise<void> {
  const hoyISO = hoyBogota().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  // Si el cliente está confirmando la fecha ("sí", "si", "correcto", "ok")
  const confirmWords = ['si', 'sí', 'correcto', 'ok', 'exacto', 'claro', 'confirmado', 'así es', 'así es', '1']
  if (conv.paso === 'confirmar_fecha' && confirmWords.includes(text.toLowerCase().trim())) {
    // La fecha ya está guardada en conv.fecha — avanzar
    const { data: esps } = await getSupabase().from('especialistas').select('id, nombre').eq('activo', true).order('nombre')
    await setConv({ ...conv, paso: 'seleccion_especialista' })
    await reply(t, buildEspecialistaMenu((esps ?? []) as { id: string; nombre: string }[], formatDate(conv.fecha!)))
    return
  }

  const p = parseFlexibleDate(text)

  if (p.error || !p.fecha) {
    await reply(t, p.error ?? '❌ No entendí la fecha.\nEscribe algo como: *mañana*, *el viernes*, *10 de agosto*, *10/08*')
    return
  }

  // Validar que no sea en el pasado
  if (p.iso < hoyISO) {
    await reply(t, `❌ La fecha *${p.display}* ya pasó. Elige una fecha futura. 😊`)
    return
  }

  // Guardar fecha provisionalmente
  await setConv({ ...conv, fecha: p.fecha.toISOString(), paso: 'confirmar_fecha' })

  // Si es ambigua o numérica → pedir confirmación explícita
  if (p.ambigua) {
    await reply(t, `📅 ¿Te refieres al *${p.display}*?\n\nEscribe *sí* para confirmar o escribe otra fecha.`)
    return
  }

  // No ambigua → confirmar y avanzar directo
  const { data: esps } = await getSupabase().from('especialistas').select('id, nombre').eq('activo', true).order('nombre')
  await setConv({ ...conv, fecha: p.fecha.toISOString(), paso: 'seleccion_especialista' })
  await reply(t, `✅ Fecha confirmada: *${p.display}*\n\n${buildEspecialistaMenu((esps ?? []) as { id: string; nombre: string }[], p.display)}`)
}

async function handleEspecialista(t: string, text: string, conv: ConvRow): Promise<void> {
  const { data: esps } = await getSupabase().from('especialistas').select('id, nombre').eq('activo', true).order('nombre')
  const lista = (esps ?? []) as { id: string; nombre: string }[]
  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > lista.length + 1) { await reply(t, `❌ Escribe un numero del *1* al *${lista.length + 1}*.`); return }
  const espId = num <= lista.length ? lista[num - 1].id : undefined
  await reply(t, '🔍 Buscando horarios disponibles...')
  const slots = await getAvailableSlots(new Date(conv.fecha!), conv.duracion ?? 60, espId)
  if (!slots.length) {
    await reply(t, `😔 Sin disponibilidad para *${formatDate(conv.fecha!)}*.\n\n¿Otra fecha? Escribela.`)
    await setConv({ ...conv, paso: 'solicitar_fecha' }); return
  }
  const MAX = 20
  const shown = slots.slice(0, MAX)
  await setConv({ ...conv, especialista_id: espId ?? null, slots_json: shown, paso: 'seleccion_horario' })
  const extra = slots.length > MAX ? `\n_Mostrando ${MAX} de ${slots.length}._` : ''
  await reply(t, buildHorariosMenu(shown, formatDate(conv.fecha!)) + extra)
}

async function handleHorario(t: string, text: string, conv: ConvRow): Promise<void> {
  const slots = (conv.slots_json as AvailableSlot[] | null) ?? []
  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > slots.length) { await reply(t, `❌ Escribe un numero del *1* al *${slots.length}*.`); return }
  const slot = slots[num - 1]
  if (new Date(slot.fecha_inicio).getTime() <= Date.now()) {
    await reply(t, '⚠️ Ese horario ya no esta disponible. Escribe *hola* para elegir otro.')
    await delConv(t); return
  }

  let clienteId = ''
  const clienteExistente = await buscarCliente(t)
  if (clienteExistente) {
    clienteId = clienteExistente.id
  } else {
    const digits = t.replace(/\D/g, '')
    const tel = digits.startsWith('57') && digits.length === 12 ? digits : digits.length === 10 ? `57${digits}` : digits
    const { data: nc } = await getSupabase().from('clientes').insert({ nombre: conv.nombre, telefono: tel, fecha_registro: new Date().toISOString() }).select('id').single()
    clienteId = nc?.id ?? ''
  }
  if (!clienteId) { await reply(t, '❌ Error al procesar. Escribe *hola* para reintentar.'); return }

  const { data: svc } = await getSupabase().from('servicios').select('id').ilike('nombre', `%${(conv.servicio_nombre ?? '').trim()}%`).limit(1).maybeSingle()
  const cita = await createAppointment({
    cliente_id: clienteId, especialista_id: slot.especialista_id,
    servicio_id: svc?.id ?? null, fecha_inicio: slot.fecha_inicio, fecha_fin: slot.fecha_fin,
  })
  if (!cita) { await reply(t, '❌ Ese horario ya fue reservado. Escribe *hola* para elegir otro.'); await delConv(t); return }

  await delConv(t)
  const confirmacion = `✅ *Cita reservada correctamente*\n\n👤 Cliente: *${conv.nombre}*\n💅 Servicio: *${conv.servicio_nombre}*\n👩 Especialista: *${slot.especialista_nombre}*\n📅 Fecha: *${formatDate(slot.fecha_inicio)}*\n⏰ Hora: *${slot.hora}*\n💵 Valor: *${conv.precio ?? 'A definir en la cita'}*\n\nGracias por elegir *Claudia Agudelo Beauty* 💖`
  await reply(t, confirmacion)
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage, sendAppointmentConfirmation } from '@/lib/evolution-api'
import { notificarEspecialista } from '@/lib/notificaciones'
import { CATEGORIAS, SERVICIOS_DATA } from '@/lib/services-data'
import { getAvailableSlots, createAppointment, type AvailableSlot } from '@/lib/scheduling'
import { parseFlexibleDate } from '@/lib/date-parser'
import { formatDate, formatCurrency } from '@/lib/utils'
import { transcribeAudio, extractIntent, type ExtractedData } from '@/lib/openai-service'

// ── Caché de servicios desde Supabase (TTL 5 min) ────────────────────────────
// Permite que los precios actualizados en el panel se reflejen en el bot
// sin consultar la BD en cada mensaje.

type SvcDB = { nombre: string; tipo_precio: string; precio?: number | null; precio_desde?: number | null; duracion_minutos: number; cat?: string; categoria_id?: string; requiere_valoracion?: boolean }

let _svcsCache: SvcDB[] | null = null
let _svcsExpiry = 0

async function getServicios(): Promise<SvcDB[]> {
  if (_svcsCache && Date.now() < _svcsExpiry) return _svcsCache
  try {
    const supabase = await createAdminClient()
    const { data } = await supabase
      .from('servicios')
      .select('nombre, tipo_precio, precio, precio_desde, duracion_minutos, categoria_id, requiere_valoracion')
      .eq('activo', true)
      .order('nombre')
    if (data && data.length > 0) {
      // Mapear categoria_id (UUID) al id corto de CATEGORIAS para compatibilidad
      const mapped = data.map(s => {
        const catLocal = CATEGORIAS.find(c => {
          // Buscar por UUID almacenado en BD vs id local ('1','2'...)
          // El seed inserta usando el UUID real, pero SERVICIOS_DATA usa '1','9' etc.
          // La relación se hace por nombre de categoría
          return false // No hay forma directa — usamos categoria_id del join
        })
        return { ...s, cat: s.categoria_id }
      })
      _svcsCache = mapped
      _svcsExpiry = Date.now() + 5 * 60 * 1000
      return mapped
    }
  } catch { /* fallback */ }
  // Fallback al archivo estático si Supabase falla
  _svcsCache = SERVICIOS_DATA.map(s => ({
    nombre: s.nombre,
    tipo_precio: s.tipo,
    precio: 'precio' in s ? s.precio : null,
    precio_desde: 'precio_desde' in s ? s.precio_desde : null,
    duracion_minutos: s.duracion,
    requiere_valoracion: 'requiere_valoracion' in s ? s.requiere_valoracion : false,
    cat: s.cat,
  }))
  _svcsExpiry = Date.now() + 60 * 1000 // 1 min si es fallback
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
}

type Supabase = Awaited<ReturnType<typeof createAdminClient>>

// ── Constructores de menú ─────────────────────────────────────────────────────

function nb(i: number) { return `*${i}.*` }

function buildMainMenu(): string {
  return `🌸 *CLAUDIA AGUDELO BEAUTY*\n\n¡Hola! 😊 Será un gusto atenderte.\n\nSelecciona una categoría:\n\n${
    CATEGORIAS.map((c, i) => `${nb(i+1)} ${c.icono} ${c.nombre}`).join('\n')
  }\n\n_Escribe el número de tu opción._`
}

async function buildCategoryMenu(catId: string): Promise<string> {
  const cat = CATEGORIAS.find(c => c.id === catId)!
  const svcsLocal = SERVICIOS_DATA.filter(s => s.cat === catId)
  // Cargar precios desde Supabase (con caché)
  const svcsBD = await getServicios()
  const items = svcsLocal.map((s, i) => {
    // Buscar precio actualizado en BD por nombre
    const fromBD = svcsBD.find(b => b.nombre.toLowerCase() === s.nombre.toLowerCase())
    const tipo  = fromBD?.tipo_precio ?? s.tipo
    const prec  = fromBD?.precio      ?? ('precio' in s ? s.precio : undefined)
    const desde = fromBD?.precio_desde ?? ('precio_desde' in s ? s.precio_desde : undefined)
    let p = ''
    if (tipo === 'fijo'  && prec)  p = `  ·  $${Number(prec).toLocaleString('es-CO')}`
    if (tipo === 'desde' && desde) p = `  ·  desde $${Number(desde).toLocaleString('es-CO')}`
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

// ── Estado en Supabase ────────────────────────────────────────────────────────

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
    if (!from || isFromMe || !message) return NextResponse.json({ ok: true })

    const remoteJid: string = body.data?.key?.remoteJid ?? ''
    if (remoteJid.endsWith('@g.us')) return NextResponse.json({ ok: true })

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
    await reply(telefono, buildMainMenu(), supabase)
    await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
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
      await delConv(telefono, supabase)
      await reply(telefono, buildMainMenu(), supabase)
      await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
      return

    case 'ver_categorias':
      await delConv(telefono, supabase)
      await reply(telefono, buildMainMenu(), supabase)
      await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
      return

    case 'ver_servicios':
      if (ext.categoria_id) {
        await setConv(supabase, { telefono, paso: 'seleccion_servicio', categoria_id: ext.categoria_id })
        await reply(telefono, await buildCategoryMenu(ext.categoria_id), supabase)
      } else {
        await delConv(telefono, supabase)
        await reply(telefono, buildMainMenu(), supabase)
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
      await delConv(telefono, supabase)
      await reply(telefono, '❌ Para cancelar tu cita contáctanos directamente.\nO escribe *hola* para hacer una nueva reserva.', supabase)
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
        await reply(telefono, buildMainMenu(), supabase)
        await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
      }
      return

    default:
      if (conv) {
        await dispatchPaso(telefono, ext.textoProcesado, conv, supabase)
      } else {
        await reply(telefono, buildMainMenu(), supabase)
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
  let svcData = servicio_nombre
    ? SERVICIOS_DATA.find(s => s.nombre.toLowerCase() === servicio_nombre.toLowerCase())
    : null
  if (!svcData && servicio_nombre)
    svcData = SERVICIOS_DATA.find(s => s.nombre.toLowerCase().includes(servicio_nombre.toLowerCase()))

  // Precio desde Supabase (sobrescribe el local si existe)
  const svcsBD = await getServicios()
  const fromBD = svcData ? svcsBD.find(b => b.nombre.toLowerCase() === svcData!.nombre.toLowerCase()) : null

  const svcTipo   = fromBD?.tipo_precio    ?? (svcData ? svcData.tipo : 'valoracion')
  const svcPrec   = fromBD?.precio         ?? ('precio' in (svcData ?? {}) ? (svcData as {precio?:number}).precio : null)
  const svcDesde  = fromBD?.precio_desde   ?? ('precio_desde' in (svcData ?? {}) ? (svcData as {precio_desde?:number}).precio_desde : null)
  const svcDur    = fromBD?.duracion_minutos ?? (svcData?.duracion ?? 60)
  const svcReqVal = fromBD?.requiere_valoracion ?? ('requiere_valoracion' in (svcData ?? {}) ? (svcData as {requiere_valoracion?:boolean}).requiere_valoracion : false)

  // ── Decidir qué preguntar ─────────────────────────────────────────────────

  // 1. Sin servicio identificado → mostrar categoría si la hay, si no menú principal
  if (!svcData) {
    if (categoria_id) {
      await setConv(supabase, { telefono, paso: 'seleccion_servicio', categoria_id })
      await reply(telefono, await buildCategoryMenu(categoria_id), supabase)
    } else {
      await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
      await reply(telefono, buildMainMenu(), supabase)
    }
    return
  }

  // Calcular precio
  let precio = 'Requiere valoración'
  if (svcTipo === 'fijo'  && svcPrec)  precio = formatCurrency(Number(svcPrec))
  if (svcTipo === 'desde' && svcDesde) precio = `Desde ${formatCurrency(Number(svcDesde))}`

  // 2. Sin nombre → pedir nombre (y persistir todo lo que ya sabemos)
  if (!nombre) {
    await setConv(supabase, {
      telefono,
      paso:            'solicitar_nombre',
      categoria_id:    svcData?.cat ?? null,
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
      categoria_id:    svcData?.cat ?? null,
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
    categoria_id:    svcData?.cat ?? null,
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
    case 'seleccion_categoria':  await handleCatSelection(telefono, text, conv, supabase); break
    case 'seleccion_servicio':   await handleSvcSelection(telefono, text, conv, supabase); break
    case 'solicitar_nombre':     await handleNombre(telefono, text, conv, supabase); break
    case 'solicitar_fecha':      await handleFecha(telefono, text, conv, supabase); break
    case 'seleccion_especialista': await handleEspecialista(telefono, text, conv, supabase); break
    case 'seleccion_horario':    await handleHorario(telefono, text, conv, supabase); break
    default:
      await delConv(telefono, supabase)
      await reply(telefono, buildMainMenu(), supabase)
      await setConv(supabase, { telefono, paso: 'seleccion_categoria' })
  }
}

async function handleCatSelection(t: string, text: string, conv: ConvRow, sb: Supabase) {
  const num = parseInt(text)
  if (isNaN(num) || num < 1 || num > CATEGORIAS.length) {
    await reply(t, `❌ Escribe un número del *1* al *${CATEGORIAS.length}*.`, sb); return
  }
  const cat = CATEGORIAS[num - 1]
  await setConv(sb, { ...conv, categoria_id: cat.id, paso: 'seleccion_servicio' })
  await reply(t, await buildCategoryMenu(cat.id), sb)
}

async function handleSvcSelection(t: string, text: string, conv: ConvRow, sb: Supabase) {
  const svcs = SERVICIOS_DATA.filter(s => s.cat === conv.categoria_id)
  const num  = parseInt(text)
  if (isNaN(num) || num < 1 || num > svcs.length) {
    await reply(t, `❌ Escribe un número del *1* al *${svcs.length}*.`, sb); return
  }
  const svc = svcs[num - 1]

  // Precio actualizado desde Supabase
  const svcsBD = await getServicios()
  const fromBD = svcsBD.find(b => b.nombre.toLowerCase() === svc.nombre.toLowerCase())
  const tipo   = fromBD?.tipo_precio ?? svc.tipo
  const prec   = fromBD?.precio       ?? ('precio' in svc ? svc.precio : null)
  const desde  = fromBD?.precio_desde ?? ('precio_desde' in svc ? svc.precio_desde : null)
  const dur    = fromBD?.duracion_minutos ?? svc.duracion
  const reqVal = fromBD?.requiere_valoracion ?? ('requiere_valoracion' in svc ? svc.requiere_valoracion : false)

  let precio = 'Requiere valoración'
  if (tipo === 'fijo'  && prec)  precio = formatCurrency(Number(prec))
  if (tipo === 'desde' && desde) precio = `Desde ${formatCurrency(Number(desde))}`

  await setConv(sb, { ...conv, servicio_nombre: svc.nombre, duracion: dur, precio, paso: 'solicitar_nombre' })

  const priceMsg = (tipo === 'valoracion' || reqVal)
    ? '\n\nℹ️ Precio según largo, cantidad y técnica.'
    : `\n\n💵 Precio: *${precio}*  ⏱️ Duración: *${dur} min*`
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

  // Buscar o crear cliente
  let clienteId = ''
  const { data: existing } = await sb.from('clientes').select('id').eq('telefono', t).maybeSingle()
  if (existing) {
    clienteId = existing.id
  } else {
    const { data: nc } = await sb.from('clientes')
      .insert({ nombre: conv.nombre, telefono: t, fecha_registro: new Date().toISOString() })
      .select('id').single()
    clienteId = nc?.id ?? ''
  }
  if (!clienteId) { await reply(t, '❌ Error al procesar. Escribe *hola* para reintentar.', sb); return }

  const { data: svc } = await sb.from('servicios').select('id').ilike('nombre', conv.servicio_nombre ?? '').maybeSingle()
  if (!svc) { await reply(t, '❌ Servicio no encontrado. Escribe *hola*.', sb); await delConv(t, sb); return }

  const cita = await createAppointment({
    cliente_id: clienteId, especialista_id: slot.especialista_id,
    servicio_id: svc.id, fecha_inicio: slot.fecha_inicio, fecha_fin: slot.fecha_fin,
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

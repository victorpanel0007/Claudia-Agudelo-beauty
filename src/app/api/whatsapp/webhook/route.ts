import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage, sendAppointmentConfirmation } from '@/lib/evolution-api'
import { notificarEspecialista } from '@/lib/notificaciones'
import { SERVICIOS_DATA } from '@/lib/services-data'
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

// ── Helpers de estado en Supabase ─────────────────────────────────────────────

async function getConv(telefono: string, supabase: Supabase): Promise<ConvRow | null> {
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

    // Ignorar mensajes de grupos (remoteJid termina en @g.us)
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

// ── Mensaje de bienvenida ─────────────────────────────────────────────────────

function buildWelcomeMessage(): string {
  return `¡Hola! 👋 Bienvenido(a) a *Claudia Agudelo Beauty* 💖

Será un gusto atenderte.

¿En qué servicio estás interesado(a)? Puedes escribirlo con tus propias palabras, por ejemplo:

💅 Uñas
💆 Masaje
✨ Limpieza facial
💇 Peluquería
👁️ Pestañas
🦶 Podología

Estoy aquí para ayudarte a reservar tu cita. 😊`
}

// ── Normalización y utilidades de texto ──────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9\s]/g, ' ')                     // quitar símbolos
    .replace(/\s+/g, ' ').trim()
}

/** Distancia de Levenshtein simplificada para detectar errores ortográficos */
function similaridad(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 3 || b.length < 3) return 0
  // Coincidencia de substrings: si uno contiene al otro
  if (a.includes(b) || b.includes(a)) return 0.9
  // Trigramas compartidos
  const triA = new Set<string>()
  const triB = new Set<string>()
  for (let i = 0; i < a.length - 2; i++) triA.add(a.slice(i, i + 3))
  for (let i = 0; i < b.length - 2; i++) triB.add(b.slice(i, i + 3))
  let shared = 0
  triA.forEach(t => { if (triB.has(t)) shared++ })
  return (2 * shared) / (triA.size + triB.size)
}

// ── Mapa de intenciones → grupos de servicios ─────────────────────────────────
// Cada entrada mapea palabras clave (normalizadas) a un grupo de servicios por nombre

const GRUPOS: Record<string, string[]> = {
  // Manicura
  'manicura':          ['Manos tradicionales', 'Manos semipermanente'],
  'manos':             ['Manos tradicionales', 'Manos semipermanente'],
  'manos tradicional': ['Manos tradicionales'],
  'manos semipermanente': ['Manos semipermanente'],
  'manos semi':        ['Manos semipermanente'],
  // Pedicura
  'pedicura':          ['Pies tradicionales', 'Pies semipermanente', 'Pedicure Spa'],
  'pedicure':          ['Pies tradicionales', 'Pies semipermanente', 'Pedicure Spa'],
  'pies':              ['Pies tradicionales', 'Pies semipermanente', 'Pedicure Spa'],
  'pies tradicional':  ['Pies tradicionales'],
  'pies semipermanente': ['Pies semipermanente'],
  'pies semi':         ['Pies semipermanente'],
  // Manos y pies
  'manos y pies':      ['Manos y pies tradicionales', 'Manos y pies semipermanente'],
  'manos pies':        ['Manos y pies tradicionales', 'Manos y pies semipermanente'],
  // Uñas en general
  'una':               ['Manos tradicionales', 'Pies tradicionales', 'Manos semipermanente', 'Pies semipermanente', 'Uñas acrílicas', 'Polygel', 'Uñas Soft Gel o Press On'],
  'unas':              ['Manos tradicionales', 'Pies tradicionales', 'Manos semipermanente', 'Pies semipermanente', 'Uñas acrílicas', 'Polygel', 'Uñas Soft Gel o Press On'],
  'nail':              ['Manos tradicionales', 'Manos semipermanente', 'Uñas acrílicas'],
  'acrilicas':         ['Uñas acrílicas'],
  'acrilica':          ['Uñas acrílicas'],
  'polygel':           ['Polygel'],
  'poli gel':          ['Polygel'],
  'soft gel':          ['Uñas Soft Gel o Press On'],
  'press on':          ['Uñas Soft Gel o Press On'],
  'gel':               ['Manos semipermanente', 'Pies semipermanente', 'Uñas Soft Gel o Press On'],
  'semipermanente':    ['Manos semipermanente', 'Pies semipermanente', 'Manos y pies semipermanente'],
  'semi permanente':   ['Manos semipermanente', 'Pies semipermanente', 'Manos y pies semipermanente'],
  'rubber':            ['Base Rubber'],
  'base rubber':       ['Base Rubber'],
  'retoque':           ['Retoque acrílico'],
  'limpieza manos':    ['Limpieza de manos o pies'],
  'limpieza pies':     ['Limpieza de manos o pies'],
  'spa':               ['Pedicure Spa'],
  // Masajes
  'masaje':            ['Masaje de relajación', 'Masaje solo espalda'],
  'masajes':           ['Masaje de relajación', 'Masaje solo espalda'],
  'relajacion':        ['Masaje de relajación'],
  'relajante':         ['Masaje de relajación'],
  'espalda':           ['Masaje solo espalda'],
  'masaje espalda':    ['Masaje solo espalda'],
  // Facial
  'facial':            ['Limpieza facial'],
  'limpieza facial':   ['Limpieza facial'],
  'limpieza cara':     ['Limpieza facial'],
  'limpieza cutis':    ['Limpieza facial'],
  'cara':              ['Limpieza facial'],
  'cutis':             ['Limpieza facial'],
  // Cejas
  'ceja':              ['Depilación de cejas con hilo', 'Depilación de cejas con cera', 'Depilación de cejas con cuchilla', 'Laminado de cejas', 'Laminado de cejas + tinte'],
  'cejas':             ['Depilación de cejas con hilo', 'Depilación de cejas con cera', 'Depilación de cejas con cuchilla', 'Laminado de cejas', 'Laminado de cejas + tinte'],
  'laminado cejas':    ['Laminado de cejas', 'Laminado de cejas + tinte'],
  'laminado':          ['Laminado de cejas', 'Laminado de cejas + tinte'],
  'hilo':              ['Depilación de cejas con hilo'],
  'cera':              ['Depilación de cejas con cera'],
  'pigmento':          ['Depilación y pigmento'],
  // Pestañas
  'pestana':           ['Lifting de pestañas', 'Lifting efecto pestañina', 'Pestañas punto a punto', 'Pestañas pelo a pelo'],
  'pestanas':          ['Lifting de pestañas', 'Lifting efecto pestañina', 'Pestañas punto a punto', 'Pestañas pelo a pelo'],
  'pestañita':         ['Lifting de pestañas', 'Lifting efecto pestañina'],
  'lifting':           ['Lifting de pestañas', 'Lifting efecto pestañina'],
  'lifting pestanas':  ['Lifting de pestañas', 'Lifting efecto pestañina'],
  'pelo a pelo':       ['Pestañas pelo a pelo'],
  'punto a punto':     ['Pestañas punto a punto'],
  'pestanina':         ['Lifting efecto pestañina'],
  // Peinados
  'peinado':           ['Peinado Social', 'Peinado de novia', 'Peinado Casual', 'Peinado de niña', 'Trenzas'],
  'peinados':          ['Peinado Social', 'Peinado de novia', 'Peinado Casual', 'Peinado de niña', 'Trenzas'],
  'trenza':            ['Trenzas'],
  'trenzas':           ['Trenzas'],
  'novia peinado':     ['Peinado de novia'],
  'peinado nina':      ['Peinado de niña'],
  // Maquillaje
  'maquillaje':        ['Maquillaje Social', 'Maquillaje de novia', 'Maquillaje Casual'],
  'maquilla':          ['Maquillaje Social', 'Maquillaje de novia', 'Maquillaje Casual'],
  'make up':           ['Maquillaje Social', 'Maquillaje de novia', 'Maquillaje Casual'],
  'makeup':            ['Maquillaje Social', 'Maquillaje de novia', 'Maquillaje Casual'],
  'make':              ['Maquillaje Social', 'Maquillaje Casual'],
  'maquillaje novia':  ['Maquillaje de novia'],
  // Barbería
  'barba':             ['Arreglo de barba', 'Afeitado'],
  'barberia':          ['Corte clásico', 'Corte moderno', 'Arreglo de barba', 'Afeitado'],
  'barbería':          ['Corte clásico', 'Corte moderno', 'Arreglo de barba', 'Afeitado'],
  'corte':             ['Corte clásico', 'Corte moderno', 'Diseño de corte', 'Corte de puntas'],
  'afeitado':          ['Afeitado'],
  'rasurado':          ['Afeitado'],
  // Depilación corporal
  'depilacion':        ['Depilación axilas', 'Depilación media pierna', 'Depilación pierna completa', 'Depilación bikini', 'Depilación bozo', 'Depilación nariz'],
  'depilar':           ['Depilación axilas', 'Depilación media pierna', 'Depilación pierna completa', 'Depilación bikini', 'Depilación bozo', 'Depilación nariz'],
  'axilas':            ['Depilación axilas'],
  'pierna':            ['Depilación media pierna', 'Depilación pierna completa'],
  'bikini':            ['Depilación bikini'],
  'bozo':              ['Depilación bozo'],
  'nariz':             ['Depilación nariz'],
  // Peluquería
  'cabello':           ['Hidratación capilar', 'Cepillado', 'Ondas', 'Planchado', 'Keratina', 'Balayage', 'Mechas', 'Rayitos'],
  'pelo':              ['Hidratación capilar', 'Cepillado', 'Ondas', 'Planchado', 'Corte de puntas', 'Diseño de corte'],
  'peluqueria':        ['Hidratación capilar', 'Cepillado', 'Ondas', 'Planchado', 'Keratina', 'Balayage', 'Mechas'],
  'keratina':          ['Keratina'],
  'balayage':          ['Balayage'],
  'mechas':            ['Mechas'],
  'baby light':        ['Baby Light'],
  'babylight':         ['Baby Light'],
  'rayitos':           ['Rayitos'],
  'highlights':        ['Highlights'],
  'hidratacion':       ['Hidratación capilar'],
  'hidratacion capilar': ['Hidratación capilar'],
  'cepillado':         ['Cepillado'],
  'planchado':         ['Planchado'],
  'ondas':             ['Ondas'],
  'aminoacidos':       ['Reposición de aminoácidos'],
  'split ender':       ['Split Ender'],
  'puntas':            ['Corte de puntas'],
  'radiofrecuencia':   ['Radiofrecuencia capilar'],
  'extensiones':       ['Extensiones de cabello'],
  // Podología
  'podologia':         ['Correctores Ungueales', 'Ortonixia'],
  'ortonixia':         ['Ortonixia'],
  'correctores':       ['Correctores Ungueales'],
  'ungueales':         ['Correctores Ungueales'],
  'pies medicos':      ['Ortonixia', 'Correctores Ungueales'],
}

// ── Frases completas de clientes → servicio directo ──────────────────────────
// Patrones conversacionales que deben resolverse directamente

const FRASES_DIRECTAS: Array<{ patron: RegExp; servicios: string[] }> = [
  // Manos y pies juntos
  { patron: /manos?\s*y\s*pies?/i,           servicios: ['Manos y pies tradicionales', 'Manos y pies semipermanente'] },
  { patron: /pies?\s*y\s*manos?/i,           servicios: ['Manos y pies tradicionales', 'Manos y pies semipermanente'] },
  // Manos solas
  { patron: /\bmanos?\s*(tradicional|clasic)/i, servicios: ['Manos tradicionales'] },
  { patron: /\bmanos?\s*semi/i,              servicios: ['Manos semipermanente'] },
  // Pies solos
  { patron: /\bpies?\s*(tradicional|clasic)/i, servicios: ['Pies tradicionales'] },
  { patron: /\bpies?\s*semi/i,               servicios: ['Pies semipermanente'] },
  // Pestañas con errores comunes
  { patron: /pesta[nñ]it/i,                  servicios: ['Lifting de pestañas', 'Lifting efecto pestañina'] },
  { patron: /lift.*pest/i,                   servicios: ['Lifting de pestañas', 'Lifting efecto pestañina'] },
  // Masaje
  { patron: /masaje.*relaj|relaj.*masaje/i,  servicios: ['Masaje de relajación'] },
  { patron: /masaje.*espal|espal.*masaje/i,  servicios: ['Masaje solo espalda'] },
  // Facial
  { patron: /limpi.*faci|faci.*limpi/i,      servicios: ['Limpieza facial'] },
  { patron: /limpi.*cara|cara.*limpi/i,      servicios: ['Limpieza facial'] },
  // Uñas acrílicas
  { patron: /u[nñ]as?\s*acril/i,             servicios: ['Uñas acrílicas'] },
  { patron: /acril/i,                        servicios: ['Uñas acrílicas', 'Retoque acrílico'] },
  // Maquillaje novia
  { patron: /maquill.*novia|novia.*maquill/i, servicios: ['Maquillaje de novia'] },
  // Peinado novia
  { patron: /peinad.*novia|novia.*peinad/i,  servicios: ['Peinado de novia'] },
  // Cejas depilación
  { patron: /depil.*ceja|ceja.*depil/i,      servicios: ['Depilación de cejas con hilo', 'Depilación de cejas con cera', 'Depilación de cejas con cuchilla'] },
]

// ── Búsqueda de servicio por texto libre ─────────────────────────────────────

interface MatchResult {
  exact: (typeof SERVICIOS_DATA)[0] | null
  multiple: (typeof SERVICIOS_DATA)[0][]
}

function matchServicio(text: string): MatchResult {
  const normalized = norm(text)

  const getServicio = (nombre: string) =>
    SERVICIOS_DATA.find(s => norm(s.nombre) === norm(nombre))

  const getGrupo = (nombres: string[]) =>
    nombres.map(n => getServicio(n)).filter(Boolean) as (typeof SERVICIOS_DATA)[0][]

  // ── 1. Coincidencia exacta con nombre de servicio ──────────────────────
  const exacto = SERVICIOS_DATA.find(s => norm(s.nombre) === normalized)
  if (exacto) return { exact: exacto, multiple: [] }

  // ── 2. El texto contiene el nombre completo del servicio ───────────────
  const contiene = SERVICIOS_DATA.find(s => normalized.includes(norm(s.nombre)))
  if (contiene) return { exact: contiene, multiple: [] }

  // ── 3. Frases conversacionales con patrones regex ─────────────────────
  for (const { patron, servicios } of FRASES_DIRECTAS) {
    if (patron.test(text)) {
      const grupo = getGrupo(servicios)
      if (grupo.length === 1) return { exact: grupo[0], multiple: [] }
      if (grupo.length > 1)  return { exact: null, multiple: grupo }
    }
  }

  // ── 4. Frases multi-palabra del mapa (más específicas primero) ─────────
  const claves = Object.keys(GRUPOS).sort((a, b) => b.length - a.length)
  for (const clave of claves) {
    if (normalized.includes(clave)) {
      const grupo = getGrupo(GRUPOS[clave])
      if (grupo.length === 1) return { exact: grupo[0], multiple: [] }
      if (grupo.length > 1)  return { exact: null, multiple: grupo }
    }
  }

  // ── 5. Palabras individuales del texto contra nombres de servicios ─────
  const words = normalized.split(/\s+/).filter(w => w.length > 2)
  const scored = SERVICIOS_DATA.map(s => {
    const sn = norm(s.nombre)
    let score = 0
    for (const w of words) {
      if (sn.includes(w)) score += 2
      else if (similaridad(w, sn) > 0.7) score += 1
    }
    return { s, score }
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score)

  if (scored.length === 1) return { exact: scored[0].s, multiple: [] }
  if (scored.length >= 2 && scored.length <= 12) return { exact: null, multiple: scored.map(x => x.s) }

  // ── 6. Similitud difusa palabra a palabra ──────────────────────────────
  for (const w of words) {
    if (w.length < 4) continue
    const fuzzy = SERVICIOS_DATA.filter(s =>
      norm(s.nombre).split(/\s+/).some(sw => similaridad(w, sw) > 0.75)
    )
    if (fuzzy.length === 1) return { exact: fuzzy[0], multiple: [] }
    if (fuzzy.length > 1 && fuzzy.length <= 8) return { exact: null, multiple: fuzzy }
  }

  return { exact: null, multiple: [] }
}

// ── Detección de intenciones ──────────────────────────────────────────────────

type Intencion =
  | 'saludo'
  | 'cancelar'
  | 'cambiar_servicio'
  | 'cambiar_fecha'
  | 'cambiar_hora'
  | 'agradecimiento'
  | 'despedida'
  | null

function detectarIntencion(text: string): Intencion {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const patrones: { intencion: Intencion; palabras: string[] }[] = [
    {
      intencion: 'cancelar',
      palabras: [
        'cancelar', 'cancela', 'ya no', 'olvidalo', 'olvídalo', 'olvida',
        'mejor despues', 'mejor después', 'no quiero', 'dejalo', 'déjalo',
        'no gracias', 'salir', 'terminar', 'no importa',
      ],
    },
    {
      intencion: 'cambiar_servicio',
      palabras: [
        'cambiar servicio', 'cambio de servicio', 'otro servicio', 'otro tratamiento',
        'cambié de opinión', 'cambie de opinion', 'quiero otro', 'prefiero otro',
        'ese no', 'no ese', 'mejor otro', 'quiero cambiar', 'cambiar de servicio',
        'quiero escoger otro', 'escoger otro', 'cambiar el servicio',
      ],
    },
    {
      intencion: 'cambiar_fecha',
      palabras: [
        'cambiar fecha', 'cambiar el dia', 'cambiar el día', 'otro dia', 'otro día',
        'otra fecha', 'quiero otra fecha', 'cambio de fecha', 'ese dia no',
        'ese día no', 'no puedo ese dia', 'no puedo ese día', 'mejor otro dia',
        'mejor otro día', 'quiero cambiar la fecha', 'cambiar dia', 'cambiar día',
      ],
    },
    {
      intencion: 'cambiar_hora',
      palabras: [
        'cambiar hora', 'otra hora', 'otro horario', 'mas tarde', 'más tarde',
        'mas temprano', 'más temprano', 'ese horario no', 'no me sirve',
        'quiero otra hora', 'cambio de hora', 'diferente hora', 'cambiar el horario',
        'tienes otra hora', '¿tienes otra hora',
      ],
    },
    {
      intencion: 'saludo',
      palabras: [
        'hola', 'buenas', 'buenos dias', 'buenos días', 'buenas tardes',
        'buenas noches', 'hi', 'hello', 'buen dia', 'buen día', 'como estas',
        'cómo estás', 'que tal', 'qué tal', 'ey', 'hey',
      ],
    },
    {
      intencion: 'agradecimiento',
      palabras: [
        'gracias', 'muchas gracias', 'muy amable', 'excelente', 'perfecto',
        'genial', 'chevere', 'chévere', 'bien', 'listo', 'ok gracias',
        'de nada', 'con gusto',
      ],
    },
    {
      intencion: 'despedida',
      palabras: [
        'adios', 'adiós', 'hasta luego', 'nos vemos', 'hasta pronto',
        'feliz dia', 'feliz día', 'bye', 'chao', 'hasta mañana', 'cuídate',
        'cuidate', 'hasta la proxima', 'hasta la próxima',
      ],
    },
  ]

  for (const { intencion, palabras } of patrones) {
    if (palabras.some(p => t.includes(p) || t === p)) {
      return intencion
    }
  }

  return null
}

// ── Procesador principal ──────────────────────────────────────────────────────

async function processMessage(telefono: string, text: string) {
  const supabase  = await createAdminClient()
  const lowerText = text.toLowerCase().trim()

  await supabase.from('mensajes_whatsapp').insert({
    telefono,
    mensaje: text,
    tipo:    'entrante',
    fecha:   new Date().toISOString(),
  })

  const conv = await getConv(telefono, supabase)

  // ── Detectar intención antes de seguir el flujo ──────────────────────────
  const intencion = detectarIntencion(text)

  // Saludos — si hay conv activa continuar, si no bienvenida
  if (intencion === 'saludo') {
    if (!conv) {
      await reply(telefono, buildWelcomeMessage(), supabase)
      await setConv(supabase, { telefono, paso: 'esperando_servicio' })
    } else {
      const saludos = [
        '¡Hola! 😊 Aquí estoy para ayudarte.',
        '¡Buenas! 😊 Con gusto te atiendo.',
        '¡Hola! 👋 ¿En qué te puedo ayudar?',
      ]
      await reply(telefono, saludos[Math.floor(Math.random() * saludos.length)], supabase)
    }
    return
  }

  // Cancelar — limpiar y despedir
  if (intencion === 'cancelar') {
    await delConv(telefono, supabase)
    await reply(
      telefono,
      `Entendido. 😊 He cancelado el proceso de reserva.\nCuando desees agendar una cita, estaré aquí para ayudarte. 💖`,
      supabase
    )
    return
  }

  // Agradecimientos
  if (intencion === 'agradecimiento') {
    await reply(
      telefono,
      `¡Con mucho gusto! 😊 Será un placer atenderte. 💖`,
      supabase
    )
    return
  }

  // Despedidas
  if (intencion === 'despedida') {
    await reply(
      telefono,
      `¡Hasta luego! 😊 Fue un placer atenderte. ¡Que tengas un excelente día! 💖`,
      supabase
    )
    return
  }

  // Cambiar servicio (con conversación activa)
  if (intencion === 'cambiar_servicio' && conv) {
    await setConv(supabase, { ...conv, servicio_nombre: null, duracion: null, precio: null, paso: 'esperando_servicio' })
    await reply(
      telefono,
      `Claro, con mucho gusto. 😊\n¿Qué servicio deseas reservar ahora?`,
      supabase
    )
    return
  }

  // Cambiar fecha (con conversación activa que ya tiene servicio)
  if (intencion === 'cambiar_fecha' && conv && conv.servicio_nombre) {
    await setConv(supabase, { ...conv, fecha: null, especialista_id: null, slots_json: null, paso: 'solicitar_fecha' })
    await reply(
      telefono,
      `Perfecto. 😊\n¿Para qué fecha deseas agendar tu cita?`,
      supabase
    )
    return
  }

  // Cambiar hora (con conversación activa que ya tiene fecha)
  if (intencion === 'cambiar_hora' && conv && conv.fecha) {
    const fecha    = new Date(conv.fecha)
    const duracion = conv.duracion ?? 60
    const slots    = await getAvailableSlots(fecha, duracion, conv.especialista_id ?? undefined)

    if (!slots.length) {
      await setConv(supabase, { ...conv, slots_json: null, paso: 'solicitar_fecha' })
      await reply(
        telefono,
        `😔 No hay más horarios disponibles para ese día.\n¿Deseas elegir otra fecha?\n• *mañana*\n• *próximo lunes*`,
        supabase
      )
      return
    }

    const MAX_SHOW = 20
    const shown    = slots.slice(0, MAX_SHOW)
    await setConv(supabase, { ...conv, slots_json: shown, paso: 'seleccion_horario' })

    const numberEmojis = [
      '1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟',
      '1️⃣1️⃣','1️⃣2️⃣','1️⃣3️⃣','1️⃣4️⃣','1️⃣5️⃣','1️⃣6️⃣','1️⃣7️⃣','1️⃣8️⃣','1️⃣9️⃣','2️⃣0️⃣',
    ]
    const slotsList = shown.map((s, i) => `${numberEmojis[i]} *${s.hora}* — ${s.especialista_nombre}`).join('\n')
    await reply(
      telefono,
      `Claro. 😊 Estos son los horarios disponibles:\n\n${slotsList}\n\n✍️ Escribe el número del horario que prefieres:`,
      supabase
    )
    return
  }

  // ── Sin conversación activa → bienvenida ────────────────────────────────
  if (!conv) {
    // Si no es intención especial, intentar detectar servicio directamente
    const { exact, multiple } = matchServicio(text)
    if (exact || multiple.length > 0) {
      const nuevaConv: ConvRow = { telefono, paso: 'esperando_servicio' }
      await setConv(supabase, nuevaConv)
      await handleServicioLibre(telefono, text, nuevaConv, supabase)
      return
    }
    await reply(telefono, buildWelcomeMessage(), supabase)
    await setConv(supabase, { telefono, paso: 'esperando_servicio' })
    return
  }

  // ── Flujo normal ─────────────────────────────────────────────────────────
  switch (conv.paso) {
    case 'esperando_servicio':
      await handleServicioLibre(telefono, text, conv, supabase); break
    case 'seleccion_multiple':
      await handleSeleccionMultiple(telefono, text, conv, supabase); break
    case 'solicitar_nombre':
      await handleNombreInput(telefono, text, conv, supabase); break
    case 'solicitar_fecha':
      // Si escribe algo que parece una fecha, procesarlo; si no, avisar
      await handleFechaInput(telefono, text, conv, supabase); break
    case 'seleccion_especialista':
      await handleEspecialistaSelection(telefono, text, conv, supabase); break
    case 'seleccion_horario':
      await handleHorarioSelection(telefono, text, conv, supabase); break
    default:
      await delConv(telefono, supabase)
      await reply(telefono, buildWelcomeMessage(), supabase)
      await setConv(supabase, { telefono, paso: 'esperando_servicio' })
  }
}

// ── Paso: interpretar servicio desde texto libre ──────────────────────────────

async function handleServicioLibre(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const { exact, multiple } = matchServicio(text)

  if (exact) {
    await confirmarServicio(telefono, exact, conv, supabase)
    return
  }

  if (multiple.length > 0) {
    const lista = multiple.map(s => `• ${s.nombre}`).join('\n')
    await setConv(supabase, {
      ...conv,
      paso: 'seleccion_multiple',
      slots_json: multiple.map(s => ({ nombre: s.nombre } as unknown as AvailableSlot)),
    })
    await reply(
      telefono,
      `¡Claro! 💅 Tenemos varios servicios relacionados.\n¿Cuál deseas reservar?\n\n${lista}\n\n✍️ Escribe el nombre exacto del servicio que prefieres.`,
      supabase
    )
    return
  }

  await reply(
    telefono,
    `No encontré ese servicio. 😊\n\nPuedes escribirlo de otra forma, por ejemplo:\n• *uñas*\n• *masaje*\n• *limpieza facial*\n• *pestañas*\n• *cejas*\n• *cabello*\n• *pedicure*\n• *ortonixia*\n\n¿Qué servicio deseas?`,
    supabase
  )
}

// ── Paso: selección cuando hay múltiples opciones ────────────────────────────

async function handleSeleccionMultiple(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const normalized = norm(text)

  // Intentar encontrar el servicio que escribió
  const servicio = SERVICIOS_DATA.find(s =>
    norm(s.nombre) === normalized ||
    normalized.includes(norm(s.nombre)) ||
    norm(s.nombre).includes(normalized)
  )

  if (servicio) {
    await confirmarServicio(telefono, servicio, conv, supabase)
    return
  }

  // Si escribió algo nuevo, intentar como búsqueda libre completa
  const { exact, multiple } = matchServicio(text)
  if (exact) {
    await confirmarServicio(telefono, exact, conv, supabase)
    return
  }
  if (multiple.length > 0 && multiple.length <= 8) {
    // Actualizamos la lista mostrada
    const lista = multiple.map(s => `• ${s.nombre}`).join('\n')
    await setConv(supabase, {
      ...conv,
      slots_json: multiple.map(s => ({ nombre: s.nombre } as unknown as AvailableSlot)),
    })
    await reply(
      telefono,
      `No encontré ese exactamente. 🤔 ¿Te refieres a alguno de estos?\n\n${lista}\n\n✍️ Escribe el nombre del servicio que prefieres.`,
      supabase
    )
    return
  }

  const lista = (conv.slots_json as unknown as { nombre: string }[] || [])
    .map(s => `• ${s.nombre}`).join('\n')

  await reply(
    telefono,
    `No encontré ese servicio. 😊\n\nElige uno de la lista:\n\n${lista}`,
    supabase
  )
}

// ── Confirmar servicio ────────────────────────────────────────────────────────

async function confirmarServicio(
  telefono: string,
  servicio: (typeof SERVICIOS_DATA)[0],
  conv: ConvRow,
  supabase: Supabase
) {
  let precio: string
  let precioMsg: string

  if (servicio.tipo === 'fijo' && servicio.precio) {
    precio = formatCurrency(servicio.precio)
    precioMsg = `💵 Valor: *${precio}*\n⏱️ Duración aproximada: *${servicio.duracion} minutos*`
  } else if (servicio.tipo === 'desde' && servicio.precio_desde) {
    precio = `Desde ${formatCurrency(servicio.precio_desde)}`
    precioMsg = `💵 Valor: *${precio}*\n⏱️ Duración aproximada: *${servicio.duracion} minutos*`
  } else {
    precio = 'Requiere valoración'
    precioMsg = `⏱️ Duración aproximada: *${servicio.duracion} minutos*\nℹ️ El valor se define en la valoración según técnica y materiales.`
  }

  await reply(
    telefono,
    `Perfecto. ✨\n\nEl servicio seleccionado es *${servicio.nombre}*.\n${precioMsg}\n\n¿Para qué fecha deseas agendar tu cita?\n\nPuedes escribirlo así:\n• *mañana*\n• *próximo sábado*\n• *15 de julio*\n• *20/07/2026*`,
    supabase
  )

  await setConv(supabase, {
    ...conv,
    servicio_nombre: servicio.nombre,
    duracion:        servicio.duracion,
    precio,
    slots_json:      null,
    paso:            'solicitar_fecha',
  })
}

// ── Paso: nombre ──────────────────────────────────────────────────────────────

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
    `👋 Hola *${text}*!\n\n📅 ¿Qué fecha prefieres para tu cita?\n\nPuedes escribir:\n• *mañana*\n• *próximo sábado*\n• *15/06/2026*\n• *15 de junio*`,
    supabase
  )
}

// ── Paso: fecha ───────────────────────────────────────────────────────────────

async function handleFechaInput(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const parsed = parseFlexibleDate(text)

  if (!parsed.fecha || parsed.error) {
    await reply(
      telefono,
      parsed.error || `No pude entender la fecha. 😊\n\nPuedes escribir:\n• *mañana*\n• *próximo lunes*\n• *15/06/2026*\n• *15 de junio*`,
      supabase
    )
    return
  }

  const todayColStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  if (parsed.iso < todayColStr) {
    await reply(
      telefono,
      `La fecha *${parsed.display}* ya pasó. 😊\n\nElige una fecha futura:\n• *mañana*\n• *próximo sábado*\n• *20/07/2026*`,
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

  const lista    = (especialistas || []).map((e, i) => `${i + 1}. ${e.nombre}`).join('\n')
  const totalEsp = (especialistas || []).length

  await reply(
    telefono,
    `📅 Fecha confirmada: *${parsed.interpreted}* ✅\n\n👩 ¿Con qué especialista deseas tu cita?\n\n${lista}\n${totalEsp + 1}. Cualquiera disponible\n\n✍️ Escribe el número de tu preferencia:`,
    supabase
  )
}

// ── Paso: especialista ────────────────────────────────────────────────────────

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
    await reply(telefono, `Por favor escribe un número del 1 al ${totalEsp + 1}.`, supabase)
    return
  }

  const especialistaId = num <= totalEsp ? lista[num - 1].id : undefined

  await reply(telefono, `🔍 Buscando horarios disponibles...`, supabase)

  const fecha    = new Date(conv.fecha!)
  const duracion = conv.duracion ?? 60
  const slots    = await getAvailableSlots(fecha, duracion, especialistaId)

  if (!slots.length) {
    const nombreEsp = num <= totalEsp ? lista[num - 1].nombre : 'ninguna especialista'
    await reply(
      telefono,
      `😔 No hay disponibilidad para *${formatDate(fecha)}* con *${nombreEsp}*.\n\n¿Deseas elegir otra fecha?\n• *mañana*\n• *próximo lunes*\n• *20/07/2026*`,
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

  const numberEmojis = [
    '1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟',
    '1️⃣1️⃣','1️⃣2️⃣','1️⃣3️⃣','1️⃣4️⃣','1️⃣5️⃣','1️⃣6️⃣','1️⃣7️⃣','1️⃣8️⃣','1️⃣9️⃣','2️⃣0️⃣',
  ]
  const slotsList = shown
    .map((s, i) => `${numberEmojis[i]} *${s.hora}* — ${s.especialista_nombre}`)
    .join('\n')

  const extraMsg = slots.length > MAX_SHOW
    ? `\n\n_Mostrando ${MAX_SHOW} de ${slots.length} horarios._`
    : ''

  await reply(
    telefono,
    `🕐 *Horarios disponibles* para *${formatDate(fecha)}*:\n\n${slotsList}${extraMsg}\n\n✍️ Escribe el número del horario que prefieres:`,
    supabase
  )
}

// ── Paso: horario ─────────────────────────────────────────────────────────────

async function handleHorarioSelection(
  telefono: string, text: string, conv: ConvRow, supabase: Supabase
) {
  const slots = (conv.slots_json as AvailableSlot[] | null) ?? []
  const num   = parseInt(text)

  if (isNaN(num) || num < 1 || num > slots.length) {
    await reply(telefono, `Por favor escribe un número del 1 al ${slots.length}.`, supabase)
    return
  }

  const selectedSlot = slots[num - 1]

  if (!conv.nombre) {
    await setConv(supabase, { ...conv, slots_json: [selectedSlot], paso: 'solicitar_nombre' })
    await reply(telefono, `✍️ Por favor escribe tu *nombre completo* para confirmar la reserva:`, supabase)
    return
  }

  let clienteId: string | undefined
  const { data: existingClient } = await supabase
    .from('clientes')
    .select('id')
    .eq('telefono', telefono)
    .maybeSingle()

  if (existingClient) {
    clienteId = existingClient.id
    await supabase.from('clientes').update({ nombre: conv.nombre }).eq('id', clienteId)
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

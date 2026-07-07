/**
 * OpenAI Service
 *
 * Dos responsabilidades:
 *   1. transcribeAudio()   → Descarga el audio de Evolution API y lo transcribe con Whisper
 *   2. interpretMessage()  → Analiza el texto (transcrito o escrito) con GPT-4o-mini
 *                            y extrae la intención + datos estructurados del cliente
 *
 * El webhook solo llama a estas dos funciones. Toda la lógica de IA queda aquí.
 */

import axios, { AxiosError } from 'axios'
import FormData from 'form-data'
import { CATEGORIAS, SERVICIOS_DATA } from '@/lib/services-data'

// ── Configuración ─────────────────────────────────────────────────────────────

const EVOLUTION_BASE_URL  = process.env.EVOLUTION_API_URL
const EVOLUTION_API_KEY   = process.env.EVOLUTION_API_KEY
const EVOLUTION_INSTANCE  = process.env.EVOLUTION_INSTANCE_NAME
const OPENAI_API_KEY      = process.env.OPENAI_API_KEY
const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024 // 10 MB

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface TranscribeResult {
  ok:            boolean
  text?:         string
  errorMessage?: string
  errorCode?:    'too_large' | 'api_error' | 'download_error'
  meta?: {
    processingMs?: number
    mimeType?:     string
    sizeBytes?:    number
  }
}

/**
 * Intenciones que el bot puede manejar.
 * El webhook las mapea a los pasos del flujo existente.
 */
export type Intencion =
  | 'saludo'
  | 'crear_cita'
  | 'consultar_horarios'
  | 'consultar_disponibilidad'
  | 'mostrar_categorias'
  | 'mostrar_servicios'
  | 'consultar_precio'
  | 'cambiar_cita'
  | 'cancelar_cita'
  | 'consultar_especialista'
  | 'hablar_con_asesor'
  | 'agradecimiento'
  | 'despedida'
  | 'respuesta_simple'   // número, "sí", "no", nombre propio — pasar tal cual al flujo
  | 'desconocido'

export interface InterpretResult {
  ok:          boolean
  intencion:   Intencion
  /** Texto que debe entrar al flujo normal del bot (puede ser el original o uno reescrito) */
  textoProcesado: string
  /** Datos extraídos que el webhook puede usar directamente */
  datos: {
    categoria?:    string   // nombre exacto de CATEGORIAS
    categoria_id?: string   // id de CATEGORIAS
    servicio?:     string   // nombre exacto de SERVICIOS_DATA
    fecha?:        string   // texto de fecha en español: "mañana", "18 de julio", "sábado"
    hora?:         string   // texto de hora: "2:00 PM", "las dos de la tarde"
    especialista?: string   // nombre mencionado
    nombre?:       string   // nombre del cliente si lo dijo
  }
  errorMessage?: string
}

// ── 1. TRANSCRIPCIÓN ──────────────────────────────────────────────────────────

/**
 * Descarga el audio de un mensaje de WhatsApp y lo transcribe con OpenAI Whisper.
 * Todo en memoria — sin escribir a disco (compatible con Vercel serverless).
 */
export async function transcribeAudio(
  webMessageInfo: Record<string, unknown>
): Promise<TranscribeResult> {
  const startMs = Date.now()

  const missing = [
    !EVOLUTION_BASE_URL && 'EVOLUTION_API_URL',
    !EVOLUTION_API_KEY  && 'EVOLUTION_API_KEY',
    !EVOLUTION_INSTANCE && 'EVOLUTION_INSTANCE_NAME',
    !OPENAI_API_KEY     && 'OPENAI_API_KEY',
  ].filter(Boolean)

  if (missing.length) {
    return { ok: false, errorMessage: `Variables faltantes: ${missing.join(', ')}`, errorCode: 'api_error' }
  }

  // ── Descargar audio en base64 ───────────────────────────────────────────────
  let base64Audio: string
  let mimeType: string

  try {
    const { data } = await axios.post(
      `${EVOLUTION_BASE_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
      { message: webMessageInfo },
      { headers: { apikey: EVOLUTION_API_KEY!, 'Content-Type': 'application/json' }, timeout: 30000 }
    )
    if (!data?.base64) return { ok: false, errorMessage: 'Evolution API no devolvió base64', errorCode: 'download_error' }
    base64Audio = data.base64 as string
    mimeType    = (data.mimetype as string) || 'audio/ogg; codecs=opus'
  } catch (err) {
    const s = (err as AxiosError).response?.status
    console.error('[OpenAI] Error descargando audio:', (err as AxiosError).response?.data)
    return { ok: false, errorMessage: `Error descargando audio (HTTP ${s ?? 'timeout'})`, errorCode: 'download_error' }
  }

  // ── Convertir base64 → Buffer ───────────────────────────────────────────────
  const clean       = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio
  const audioBuffer = Buffer.from(clean, 'base64')
  const sizeBytes   = audioBuffer.byteLength

  if (sizeBytes > MAX_AUDIO_BYTES) {
    return { ok: false, errorMessage: 'Audio demasiado grande (máx 10 MB)', errorCode: 'too_large', meta: { sizeBytes, mimeType } }
  }

  // ── Transcribir con Whisper ─────────────────────────────────────────────────
  const ext  = mimeToExt(mimeType)
  const form = new FormData()
  form.append('file', audioBuffer, { filename: `audio.${ext}`, contentType: mimeType.split(';')[0].trim() })
  form.append('model',           TRANSCRIPTION_MODEL)
  form.append('language',        'es')
  form.append('response_format', 'text')

  try {
    const { data: raw } = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() }, timeout: 60000 }
    )
    const text = (typeof raw === 'string' ? raw : (raw as { text?: string }).text ?? '').trim()
    if (!text) return { ok: false, errorMessage: 'Transcripción vacía', errorCode: 'api_error', meta: { sizeBytes, mimeType } }

    return { ok: true, text, meta: { sizeBytes, mimeType, processingMs: Date.now() - startMs } }
  } catch (err) {
    const s = (err as AxiosError).response?.status
    console.error('[OpenAI] Error transcribiendo:', (err as AxiosError).response?.data)
    return {
      ok: false,
      errorMessage: s === 400 ? 'Audio ilegible. Grábalo nuevamente.' : `Error transcripción (HTTP ${s ?? 'timeout'})`,
      errorCode: 'api_error',
      meta: { sizeBytes, mimeType, processingMs: Date.now() - startMs },
    }
  }
}

// ── 2. INTERPRETACIÓN ─────────────────────────────────────────────────────────

/**
 * Analiza el texto transcrito (o cualquier texto) con GPT-4o-mini.
 * Extrae intención + datos estructurados considerando el contexto actual de la conversación.
 *
 * Si la API de OpenAI falla → devuelve el texto original para que el flujo siga normalmente.
 */
export async function interpretMessage(
  texto: string,
  contexto: {
    paso:             string
    servicio_nombre?: string | null
    categoria_id?:    string | null
    fecha?:           string | null
    nombre?:          string | null
  }
): Promise<InterpretResult> {

  if (!OPENAI_API_KEY) {
    return { ok: true, intencion: 'respuesta_simple', textoProcesado: texto, datos: {} }
  }

  // Construir el catálogo compacto para el prompt (no incluir precios completos para no gastar tokens)
  const catalogoResumen = CATEGORIAS.map(cat => {
    const servicios = SERVICIOS_DATA.filter(s => s.cat === cat.id).map(s => s.nombre).join(', ')
    return `${cat.id}:${cat.nombre} → [${servicios}]`
  }).join('\n')

  // Contexto de la conversación actual
  const contextoStr = [
    `paso_actual: ${contexto.paso}`,
    contexto.servicio_nombre ? `servicio_elegido: ${contexto.servicio_nombre}` : '',
    contexto.categoria_id
      ? `categoria_elegida: ${CATEGORIAS.find(c => c.id === contexto.categoria_id)?.nombre ?? ''}`
      : '',
    contexto.fecha ? `fecha_elegida: ${contexto.fecha}` : '',
    contexto.nombre ? `nombre_cliente: ${contexto.nombre}` : '',
  ].filter(Boolean).join('\n')

  const systemPrompt = `Eres la recepcionista virtual de "Claudia Agudelo Beauty", un spa y salón de belleza en Colombia.

Tu única tarea es analizar el mensaje del cliente y devolver un JSON estructurado con la intención y los datos extraídos.

CATÁLOGO DE SERVICIOS (id:categoría → [servicios]):
${catalogoResumen}

CONTEXTO ACTUAL DE LA CONVERSACIÓN:
${contextoStr || 'sin_conversacion_previa'}

INTENCIONES DISPONIBLES:
- saludo: el cliente saluda sin pedir nada específico
- crear_cita: quiere reservar un servicio (agéndar, quiero X, para cuándo tienes X)
- consultar_horarios: pregunta qué horas hay disponibles
- consultar_disponibilidad: pregunta si hay cupo en cierta fecha
- mostrar_categorias: pide ver las categorías o tipos de servicio
- mostrar_servicios: pide ver servicios de una categoría específica
- consultar_precio: pregunta cuánto vale algo
- cambiar_cita: quiere modificar una cita existente
- cancelar_cita: quiere cancelar su cita
- consultar_especialista: pregunta por una especialista en concreto
- hablar_con_asesor: pide hablar con una persona
- agradecimiento: da las gracias
- despedida: se despide
- respuesta_simple: solo da un número, "sí", "no", su nombre, una hora u otro dato puntual del paso actual
- desconocido: no se puede determinar la intención

REGLAS:
1. Si el cliente dice "manos y pies", "uñas", "manicure", "pedicure" → categoría "Manicura y Pedicura"
2. Si dice "masaje", "masajes" → categoría "Masajes"
3. Corrige errores de transcripción: "balaya"→"Balayage", "podologia"→"Podología", "masage"→"Masaje", etc.
4. Si el contexto tiene paso_actual con un servicio o fecha ya elegida y el cliente solo agrega datos nuevos, no cambies la intención a crear_cita sino a respuesta_simple con los datos extra.
5. Para fechas extrae texto en español natural: "mañana", "el sábado", "18 de julio", "el viernes en la tarde"
6. Para horas extrae en formato legible: "2:00 PM", "las 10 de la mañana"
7. El campo textoProcesado debe ser el texto limpio y correcto que el bot debe procesar (sin muletillas, corregido ortográficamente)
8. Si la intención es respuesta_simple, textoProcesado debe ser SOLO el dato puntual (el número, el nombre, la fecha, etc.)

Devuelve ÚNICAMENTE JSON válido, sin markdown, sin explicación:
{
  "intencion": "...",
  "textoProcesado": "...",
  "datos": {
    "categoria": "nombre exacto o null",
    "categoria_id": "id numérico como string o null",
    "servicio": "nombre exacto del servicio o null",
    "fecha": "texto de fecha en español o null",
    "hora": "texto de hora o null",
    "especialista": "nombre o null",
    "nombre": "nombre del cliente si lo dijo o null"
  }
}`

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model:       'gpt-4o-mini',
        temperature: 0,
        max_tokens:  300,
        messages: [
          { role: 'system',  content: systemPrompt },
          { role: 'user',    content: texto },
        ],
      },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    )

    const raw = (data?.choices?.[0]?.message?.content ?? '').trim()

    // Parsear JSON — si falla, fallback al texto original
    let parsed: {
      intencion?: string
      textoProcesado?: string
      datos?: InterpretResult['datos']
    }
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.warn('[OpenAI] JSON inválido en interpretación, fallback a texto original:', raw.slice(0, 100))
      return { ok: true, intencion: 'respuesta_simple', textoProcesado: texto, datos: {} }
    }

    // Validar que la intención sea conocida
    const intencionesValidas: Intencion[] = [
      'saludo','crear_cita','consultar_horarios','consultar_disponibilidad',
      'mostrar_categorias','mostrar_servicios','consultar_precio',
      'cambiar_cita','cancelar_cita','consultar_especialista',
      'hablar_con_asesor','agradecimiento','despedida','respuesta_simple','desconocido',
    ]
    const intencion = intencionesValidas.includes(parsed.intencion as Intencion)
      ? (parsed.intencion as Intencion)
      : 'desconocido'

    // Enriquecer datos: si GPT dio nombre de categoría pero no id, buscarlo
    const datos: InterpretResult['datos'] = parsed.datos ?? {}
    if (datos.categoria && !datos.categoria_id) {
      const cat = CATEGORIAS.find(c =>
        c.nombre.toLowerCase().includes(datos.categoria!.toLowerCase()) ||
        datos.categoria!.toLowerCase().includes(c.nombre.toLowerCase())
      )
      if (cat) datos.categoria_id = cat.id
    }
    if (datos.categoria_id && !datos.categoria) {
      datos.categoria = CATEGORIAS.find(c => c.id === datos.categoria_id)?.nombre
    }

    return {
      ok:              true,
      intencion,
      textoProcesado:  parsed.textoProcesado ?? texto,
      datos,
    }

  } catch (err) {
    const s = (err as AxiosError).response?.status
    console.error('[OpenAI] Error interpretando mensaje:', s, (err as AxiosError).response?.data)
    // Fallback graceful: el texto pasa tal cual al flujo normal
    return { ok: true, intencion: 'respuesta_simple', textoProcesado: texto, datos: {} }
  }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function mimeToExt(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase()
  const map: Record<string, string> = {
    'audio/ogg': 'ogg', 'audio/opus': 'ogg',
    'audio/mp4': 'm4a', 'audio/m4a':  'm4a',
    'audio/mpeg': 'mp3', 'audio/mp3':  'mp3',
    'audio/wav': 'wav',  'audio/wave': 'wav',
    'audio/webm': 'webm', 'audio/flac': 'flac',
    'video/mp4': 'mp4',
  }
  return map[base] ?? 'ogg'
}

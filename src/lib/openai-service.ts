/**
 * OpenAI Service
 *
 * Responsabilidades:
 *   1. transcribeAudio()  — Descarga audio de Evolution API y transcribe con Whisper (en memoria)
 *   2. extractIntent()    — Analiza CUALQUIER mensaje (texto o transcripción) con GPT-4o-mini
 *                           y devuelve TODOS los datos extraídos en una sola llamada
 *
 * El webhook usa extractIntent() para texto Y para audio por igual.
 * No hay dos flujos distintos — solo uno que entiende lenguaje natural.
 */

import axios, { AxiosError } from 'axios'
import FormData from 'form-data'
import { CATEGORIAS, SERVICIOS_DATA } from '@/lib/services-data'

// ── Config ────────────────────────────────────────────────────────────────────

const EVO_URL  = process.env.EVOLUTION_API_URL
const EVO_KEY  = process.env.EVOLUTION_API_KEY
const EVO_INST = process.env.EVOLUTION_INSTANCE_NAME
const OAI_KEY  = process.env.OPENAI_API_KEY
const WHISPER  = process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1'

const MAX_BYTES = 10 * 1024 * 1024

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TranscribeResult {
  ok:           boolean
  text?:        string
  errorMessage?: string
  errorCode?:   'too_large' | 'api_error' | 'download_error'
}

/**
 * Todo lo que el bot necesita para avanzar la reserva.
 * Cada campo es null si el cliente no lo proporcionó en este mensaje.
 */
export interface ExtractedData {
  /** Qué quiere hacer el cliente */
  intencion:
    | 'reservar'          // quiere una cita (con o sin todos los datos)
    | 'ver_servicios'     // "muéstrame los de uñas" — quiere explorar, NO reservar aún
    | 'ver_categorias'    // quiere el menú principal
    | 'consultar_precio'
    | 'consultar_disponibilidad'
    | 'cambiar_cita'
    | 'cancelar_cita'
    | 'hablar_asesor'
    | 'saludo'
    | 'agradecimiento'
    | 'despedida'
    | 'dato_puntual'      // solo responde un dato pedido: número, nombre, fecha, hora…
    | 'desconocido'

  /** Servicio identificado con nombre exacto del catálogo (null = no mencionado) */
  servicio:      string | null
  /** ID de categoría del catálogo (null = no identificada) */
  categoria_id:  string | null
  /** Fecha en español natural: "mañana", "18 de julio", "el viernes" */
  fecha:         string | null
  /** Hora en texto legible: "2:00 PM", "las 10 de la mañana" */
  hora:          string | null
  /** Nombre de la especialista mencionada */
  especialista:  string | null
  /** Nombre del cliente si lo dijo en este mensaje */
  nombre_cliente: string | null
  /** Texto limpio, corregido ortográficamente, listo para procesar */
  textoProcesado: string
}

// ── Catálogo en memoria para el prompt ───────────────────────────────────────

function buildCatalogPrompt(): string {
  return CATEGORIAS.map(cat => {
    const svcs = SERVICIOS_DATA
      .filter(s => s.cat === cat.id)
      .map(s => s.nombre)
      .join(' | ')
    return `  cat_id=${cat.id} "${cat.nombre}": ${svcs}`
  }).join('\n')
}

// ── 1. TRANSCRIPCIÓN ──────────────────────────────────────────────────────────

export async function transcribeAudio(
  webhookData: Record<string, unknown>
): Promise<TranscribeResult> {

  const missing = [
    !EVO_URL && 'EVOLUTION_API_URL', !EVO_KEY && 'EVOLUTION_API_KEY',
    !EVO_INST && 'EVOLUTION_INSTANCE_NAME', !OAI_KEY && 'OPENAI_API_KEY',
  ].filter(Boolean)
  if (missing.length) return { ok: false, errorCode: 'api_error', errorMessage: `Faltan vars: ${missing.join(', ')}` }

  // Descargar base64
  let base64: string, mime: string
  try {
    const { data } = await axios.post(
      `${EVO_URL}/chat/getBase64FromMediaMessage/${EVO_INST}`,
      { message: webhookData },
      { headers: { apikey: EVO_KEY!, 'Content-Type': 'application/json' }, timeout: 30000 }
    )
    if (!data?.base64) return { ok: false, errorCode: 'download_error', errorMessage: 'Sin base64' }
    base64 = data.base64 as string
    mime   = (data.mimetype as string) || 'audio/ogg; codecs=opus'
  } catch (e) {
    const s = (e as AxiosError).response?.status
    return { ok: false, errorCode: 'download_error', errorMessage: `Descarga fallida (HTTP ${s ?? 'timeout'})` }
  }

  const clean  = base64.includes(',') ? base64.split(',')[1] : base64
  const buf    = Buffer.from(clean, 'base64')
  if (buf.byteLength > MAX_BYTES) return { ok: false, errorCode: 'too_large', errorMessage: 'Audio > 10 MB' }

  // Transcribir
  const ext  = mimeToExt(mime)
  const form = new FormData()
  form.append('file', buf, { filename: `audio.${ext}`, contentType: mime.split(';')[0].trim() })
  form.append('model', WHISPER)
  form.append('language', 'es')
  form.append('response_format', 'text')

  try {
    const { data: raw } = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions', form,
      { headers: { Authorization: `Bearer ${OAI_KEY}`, ...form.getHeaders() }, timeout: 60000 }
    )
    const text = (typeof raw === 'string' ? raw : (raw as { text?: string }).text ?? '').trim()
    if (!text) return { ok: false, errorCode: 'api_error', errorMessage: 'Transcripción vacía' }
    return { ok: true, text }
  } catch (e) {
    const s = (e as AxiosError).response?.status
    return {
      ok: false, errorCode: 'api_error',
      errorMessage: s === 400 ? 'Audio ilegible' : `Whisper error HTTP ${s ?? 'timeout'}`,
    }
  }
}

// ── 2. EXTRACCIÓN DE INTENCIÓN + DATOS ────────────────────────────────────────

/**
 * Analiza un mensaje (texto libre o transcripción) con GPT-4o-mini.
 *
 * Siempre devuelve un ExtractedData válido.
 * Si OpenAI falla → fallback: intencion='dato_puntual', textoProcesado=texto original.
 *
 * @param texto    Mensaje del cliente
 * @param conv     Estado actual de la conversación (lo que ya se sabe)
 */
export async function extractIntent(
  texto: string,
  conv: {
    paso:             string
    servicio_nombre?: string | null
    categoria_id?:    string | null
    fecha?:           string | null
    nombre?:          string | null
  }
): Promise<ExtractedData> {

  // Sin clave → no gastar nada, devolver dato_puntual para que el flujo por número siga
  if (!OAI_KEY) return fallback(texto)

  const catalogoStr = buildCatalogPrompt()

  // Qué ya conocemos (para que GPT no lo repita innecesariamente)
  const ya = [
    conv.servicio_nombre ? `servicio ya elegido: "${conv.servicio_nombre}"` : '',
    conv.categoria_id    ? `categoría ya elegida: "${CATEGORIAS.find(c => c.id === conv.categoria_id)?.nombre}"` : '',
    conv.fecha           ? `fecha ya fijada: ${conv.fecha}` : '',
    conv.nombre          ? `nombre cliente: "${conv.nombre}"` : '',
    `paso actual del bot: ${conv.paso}`,
  ].filter(Boolean).join('\n')

  const system = `Eres la recepcionista virtual de "Claudia Agudelo Beauty" (spa/salón, Colombia).

Analiza el mensaje del cliente y devuelve UN JSON con toda la información que puedas extraer.

═══ CATÁLOGO ═══
${catalogoStr}

═══ ESTADO ACTUAL DE LA CONVERSACIÓN ═══
${ya || '(conversación nueva)'}

═══ INSTRUCCIONES ═══
1. "intencion" — elige UNA:
   • reservar           → quiere CONFIRMAR una cita de un servicio específico
   • ver_servicios      → quiere EXPLORAR servicios de una categoría (no eligió servicio aún)
   • ver_categorias     → quiere ver el menú principal de categorías
   • consultar_precio   → pregunta cuánto vale algo
   • consultar_disponibilidad → ¿hay cupo? ¿atienden hoy/mañana?
   • cambiar_cita       → modificar cita existente
   • cancelar_cita      → cancelar cita existente
   • hablar_asesor      → quiere hablar con persona humana
   • saludo             → solo saluda sin pedir nada concreto
   • agradecimiento     → da las gracias
   • despedida          → se despide
   • dato_puntual       → responde solo un dato pedido (número, nombre, fecha, hora, "sí"/"no")
   • desconocido        → no se entiende

2. Diferencia CRÍTICA:
   • "quiero ver los servicios de uñas" → ver_servicios (está explorando)
   • "quiero uñas tradicionales"        → reservar (ya eligió servicio)
   • "quiero uñas"  (ambiguo)           → ver_servicios (no especificó cuál)

3. "servicio" → nombre EXACTO del catálogo o null. Si no está en el catálogo, null.
4. "categoria_id" → id del catálogo ("1"–"10") o null.
5. "fecha" → texto en español natural: "mañana", "18 de julio", "el viernes", null.
6. "hora" → texto legible: "2:00 PM", "9:00 AM", null.
7. "textoProcesado" → texto corregido (errores de transcripción, muletillas eliminadas).
   Si es dato_puntual, textoProcesado = SOLO el dato (p.ej. "mañana", "María García", "3").
8. Corrige errores comunes: balaya→Balayage, podologia→Podología, masage→Masaje, unas→uñas.
9. Si el cliente ya tiene servicio/fecha en contexto y solo agrega un nuevo dato → dato_puntual.

Devuelve SOLO JSON válido, sin markdown:
{
  "intencion": "...",
  "servicio": "...",
  "categoria_id": "...",
  "fecha": "...",
  "hora": "...",
  "especialista": "...",
  "nombre_cliente": "...",
  "textoProcesado": "..."
}`

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini', temperature: 0, max_tokens: 250,
        messages: [{ role: 'system', content: system }, { role: 'user', content: texto }],
      },
      { headers: { Authorization: `Bearer ${OAI_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    )

    const raw = (data?.choices?.[0]?.message?.content ?? '').trim()
    let parsed: Partial<ExtractedData & { intencion: string }>

    try { parsed = JSON.parse(raw) }
    catch { return fallback(texto) }

    // Normalizar intencion
    const VALID_INT = [
      'reservar','ver_servicios','ver_categorias','consultar_precio',
      'consultar_disponibilidad','cambiar_cita','cancelar_cita',
      'hablar_asesor','saludo','agradecimiento','despedida','dato_puntual','desconocido',
    ] as const
    const intencion = VALID_INT.includes(parsed.intencion as typeof VALID_INT[number])
      ? (parsed.intencion as ExtractedData['intencion'])
      : 'desconocido'

    // Enriquecer categoria_id desde nombre si GPT lo omitió
    let categoria_id = parsed.categoria_id ?? null
    if (!categoria_id && parsed.servicio) {
      const svc = SERVICIOS_DATA.find(s => s.nombre.toLowerCase() === parsed.servicio!.toLowerCase())
      if (svc) categoria_id = svc.cat
    }
    // Enriquecer desde nombre de categoría si GPT lo puso en categoria_id como nombre
    if (categoria_id && isNaN(Number(categoria_id))) {
      const cat = CATEGORIAS.find(c => c.nombre.toLowerCase().includes(categoria_id!.toLowerCase()))
      categoria_id = cat?.id ?? null
    }

    return {
      intencion,
      servicio:       parsed.servicio      ?? null,
      categoria_id,
      fecha:          parsed.fecha         ?? null,
      hora:           parsed.hora          ?? null,
      especialista:   parsed.especialista  ?? null,
      nombre_cliente: parsed.nombre_cliente ?? null,
      textoProcesado: parsed.textoProcesado ?? texto,
    }

  } catch (e) {
    console.error('[OpenAI] extractIntent error:', (e as AxiosError).response?.status)
    return fallback(texto)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fallback(texto: string): ExtractedData {
  return {
    intencion: 'dato_puntual', servicio: null, categoria_id: null,
    fecha: null, hora: null, especialista: null, nombre_cliente: null,
    textoProcesado: texto,
  }
}

function mimeToExt(mime: string): string {
  const m: Record<string, string> = {
    'audio/ogg': 'ogg', 'audio/opus': 'ogg', 'audio/mp4': 'm4a', 'audio/m4a': 'm4a',
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/wave': 'wav',
    'audio/webm': 'webm', 'audio/flac': 'flac', 'video/mp4': 'mp4',
  }
  return m[mime.split(';')[0].trim().toLowerCase()] ?? 'ogg'
}

/**
 * OpenAI Service — Transcripción de notas de voz de WhatsApp
 *
 * Flujo:
 *   1. Recibe el objeto WebMessageInfo completo del webhook de Evolution API
 *   2. Llama a POST /chat/getBase64FromMediaMessage/{instance} para obtener el audio en base64
 *   3. Convierte el base64 a Buffer (sin escribir a disco — compatible con Vercel serverless)
 *   4. Envía el Buffer a la API de transcripción de OpenAI como multipart/form-data
 *   5. Devuelve el texto transcrito
 *
 * No almacena archivos. No guarda contenido de audio. Solo registra metadata.
 */

import axios, { AxiosError } from 'axios'
import FormData from 'form-data'

// ── Configuración ─────────────────────────────────────────────────────────────

const EVOLUTION_BASE_URL  = process.env.EVOLUTION_API_URL
const EVOLUTION_API_KEY   = process.env.EVOLUTION_API_KEY
const EVOLUTION_INSTANCE  = process.env.EVOLUTION_INSTANCE_NAME
const OPENAI_API_KEY      = process.env.OPENAI_API_KEY
const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1'

/** Tamaño máximo permitido del audio: 10 MB en bytes */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TranscribeResult {
  ok:            boolean
  text?:         string
  errorMessage?: string
  /** 'too_long' | 'too_large' | 'api_error' | 'download_error' */
  errorCode?:    string
  /** Metadata de auditoría (nunca contiene el audio) */
  meta?: {
    durationMs?:     number
    processingMs?:   number
    mimeType?:       string
    sizeBytes?:      number
  }
}

// ── Servicio principal ────────────────────────────────────────────────────────

/**
 * Descarga el audio de un mensaje de WhatsApp y lo transcribe con OpenAI.
 *
 * @param webMessageInfo  El objeto `body.data` completo que llega en el webhook
 *                        (contiene la clave del mensaje y el contenido cifrado
 *                         que Evolution API necesita para descargar el media)
 */
export async function transcribeAudio(
  webMessageInfo: Record<string, unknown>
): Promise<TranscribeResult> {
  const startMs = Date.now()

  // ── Validar variables de entorno ────────────────────────────────────────────
  const missing = [
    !EVOLUTION_BASE_URL && 'EVOLUTION_API_URL',
    !EVOLUTION_API_KEY  && 'EVOLUTION_API_KEY',
    !EVOLUTION_INSTANCE && 'EVOLUTION_INSTANCE_NAME',
    !OPENAI_API_KEY     && 'OPENAI_API_KEY',
  ].filter(Boolean)

  if (missing.length) {
    return {
      ok:           false,
      errorMessage: `Variables de entorno faltantes: ${missing.join(', ')}`,
      errorCode:    'api_error',
    }
  }

  // ── Paso 1: Descargar el audio en base64 desde Evolution API ────────────────
  let base64Audio: string
  let mimeType: string

  try {
    const { data } = await axios.post(
      `${EVOLUTION_BASE_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
      { message: webMessageInfo },
      {
        headers: {
          apikey:           EVOLUTION_API_KEY!,
          'Content-Type':   'application/json',
        },
        timeout: 30000,
      }
    )

    if (!data?.base64) {
      return {
        ok:           false,
        errorMessage: 'Evolution API no devolvió el audio en base64',
        errorCode:    'download_error',
      }
    }

    base64Audio = data.base64 as string
    mimeType    = (data.mimetype as string) || 'audio/ogg; codecs=opus'

  } catch (err) {
    const axiosErr = err as AxiosError
    const status   = axiosErr.response?.status
    const body     = axiosErr.response?.data

    console.error('[OpenAI Service] Error descargando audio de Evolution:', {
      status,
      body: JSON.stringify(body),
    })

    return {
      ok:           false,
      errorMessage: `Error al descargar el audio (HTTP ${status ?? 'timeout'})`,
      errorCode:    'download_error',
    }
  }

  // ── Paso 2: Convertir base64 → Buffer (en memoria, sin disco) ───────────────
  // Eliminar el prefijo data URI si Evolution lo incluye (ej: "data:audio/ogg;base64,...")
  const cleanBase64 = base64Audio.includes(',')
    ? base64Audio.split(',')[1]
    : base64Audio

  const audioBuffer = Buffer.from(cleanBase64, 'base64')
  const sizeBytes   = audioBuffer.byteLength

  // ── Paso 3: Validar tamaño (máx 10 MB) ─────────────────────────────────────
  if (sizeBytes > MAX_AUDIO_BYTES) {
    return {
      ok:           false,
      errorMessage: `El audio pesa ${(sizeBytes / 1024 / 1024).toFixed(1)} MB, el máximo es 10 MB.`,
      errorCode:    'too_large',
      meta:         { sizeBytes, mimeType },
    }
  }

  // ── Paso 4: Determinar la extensión de archivo para OpenAI ──────────────────
  // OpenAI exige una extensión válida en el filename del form-data
  const ext = getExtensionFromMime(mimeType)

  // ── Paso 5: Transcribir con OpenAI Whisper API ──────────────────────────────
  try {
    const form = new FormData()
    form.append('file', audioBuffer, {
      filename:    `audio.${ext}`,
      contentType: mimeType.split(';')[0].trim(), // "audio/ogg" sin params
    })
    form.append('model',    TRANSCRIPTION_MODEL)
    form.append('language', 'es')   // Español colombiano
    form.append('response_format', 'text')

    const { data: transcription } = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          Authorization:   `Bearer ${OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
        timeout: 60000, // 60 s para audios largos
      }
    )

    const text = typeof transcription === 'string'
      ? transcription.trim()
      : (transcription as { text?: string }).text?.trim() ?? ''

    if (!text) {
      return {
        ok:           false,
        errorMessage: 'No se obtuvo texto de la transcripción.',
        errorCode:    'api_error',
        meta:         { sizeBytes, mimeType, processingMs: Date.now() - startMs },
      }
    }

    return {
      ok:   true,
      text,
      meta: {
        sizeBytes,
        mimeType,
        processingMs: Date.now() - startMs,
      },
    }

  } catch (err) {
    const axiosErr = err as AxiosError
    const status   = axiosErr.response?.status
    const body     = axiosErr.response?.data

    console.error('[OpenAI Service] Error transcribiendo audio:', {
      status,
      body: JSON.stringify(body),
    })

    // OpenAI devuelve 400 cuando el audio está vacío o tiene formato inválido
    if (status === 400) {
      return {
        ok:           false,
        errorMessage: 'El audio no pudo ser leído. Por favor grábalo nuevamente.',
        errorCode:    'api_error',
        meta:         { sizeBytes, mimeType, processingMs: Date.now() - startMs },
      }
    }

    return {
      ok:           false,
      errorMessage: `Error al transcribir el audio (HTTP ${status ?? 'timeout'})`,
      errorCode:    'api_error',
      meta:         { sizeBytes, mimeType, processingMs: Date.now() - startMs },
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convierte un MIME type de audio a la extensión que OpenAI acepta.
 * OpenAI soporta: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
 */
function getExtensionFromMime(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase()
  const map: Record<string, string> = {
    'audio/ogg':        'ogg',
    'audio/opus':       'ogg',
    'audio/mp4':        'm4a',
    'audio/m4a':        'm4a',
    'audio/mpeg':       'mp3',
    'audio/mp3':        'mp3',
    'audio/wav':        'wav',
    'audio/wave':       'wav',
    'audio/webm':       'webm',
    'audio/flac':       'flac',
    'video/mp4':        'mp4',
  }
  return map[base] ?? 'ogg' // WhatsApp Voice Notes son siempre ogg/opus
}

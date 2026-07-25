/**
 * OpenAI Service
 * Chat, Audio, Embeddings, Vision — servicio independiente.
 */
import OpenAI from 'openai'
import { env } from '../config/env'
import { openaiLog } from '../config/logger'
import type { ChatOptions, ChatResult, TranscribeResult } from '../types'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (_client) return _client
  _client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  return _client
}

// ── Chat ────────────────────────────────────────────────────────────────────

export async function chat(options: ChatOptions): Promise<ChatResult> {
  try {
    const oai = getClient()
    const res = await oai.chat.completions.create({
      model:       options.model       ?? 'gpt-4o-mini',
      temperature: options.temperature ?? 0.3,
      max_tokens:  options.maxTokens   ?? 1024,
      messages:    options.messages,
    })
    const text  = res.choices[0]?.message?.content ?? ''
    const usage = res.usage
      ? {
          promptTokens:     res.usage.prompt_tokens,
          completionTokens: res.usage.completion_tokens,
          totalTokens:      res.usage.total_tokens,
        }
      : undefined
    openaiLog.debug({ model: options.model, totalTokens: usage?.totalTokens }, '[OpenAI] Chat completado')
    return { ok: true, text, usage }
  } catch (err) {
    const msg = (err as Error).message
    openaiLog.error({ err: msg }, '[OpenAI] Error en chat')
    return { ok: false, errorMessage: msg }
  }
}

// ── Transcripcion de audio ──────────────────────────────────────────────────

export async function transcribeFromUrl(audioUrl: string): Promise<TranscribeResult> {
  try {
    const oai = getClient()
    const { default: axios } = await import('axios')

    // Si es Graph API de Meta, necesitamos el access token de Dualhook
    const headers: Record<string, string> = {}
    if (audioUrl.includes('graph.facebook.com') || audioUrl.includes('api.dualhook.com')) {
      const token = process.env.DUALHOOK_API_KEY ?? ''
      if (!token) return { ok: false, errorCode: 'api_error', errorMessage: 'DUALHOOK_API_KEY no configurado' }
      // Para media de Meta via Dualhook: GET /v25.0/<MEDIA_ID> devuelve la URL de descarga
      const mediaId = audioUrl.split('/').pop()?.split('?')[0] ?? ''
      const dualhookBase = 'https://api.dualhook.com/v25.0'
      // 1. Obtener URL real del archivo
      const { data: mediaData } = await axios.get<{ url: string }>(`${dualhookBase}/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 10_000,
      })
      // 2. Descargar con token
      const { data: audioBuffer } = await axios.get<Buffer>(mediaData.url, {
        responseType: 'arraybuffer',
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20_000,
      })
      const MAX_BYTES = 25 * 1024 * 1024
      if (audioBuffer.byteLength > MAX_BYTES) return { ok: false, errorCode: 'too_large', errorMessage: 'Audio supera 25MB' }
      const file = new File([new Uint8Array(audioBuffer)], 'audio.ogg', { type: 'audio/ogg' })
      const result = await oai.audio.transcriptions.create({ file, model: 'whisper-1', language: 'es' })
      openaiLog.info('[OpenAI] Audio transcrito via Graph API')
      return { ok: true, text: result.text }
    }

    // URL directa (desarrollo/pruebas)
    const { data: audioBuffer } = await axios.get<Buffer>(audioUrl, {
      responseType: 'arraybuffer', headers, timeout: 20_000,
    })
    const MAX_BYTES = 25 * 1024 * 1024
    if (audioBuffer.byteLength > MAX_BYTES) return { ok: false, errorCode: 'too_large', errorMessage: 'Audio supera 25MB' }
    const file = new File([new Uint8Array(audioBuffer)], 'audio.ogg', { type: 'audio/ogg' })
    const result = await oai.audio.transcriptions.create({ file, model: 'whisper-1', language: 'es' })
    openaiLog.info('[OpenAI] Audio transcrito')
    return { ok: true, text: result.text }
  } catch (err) {
    const msg = (err as Error).message
    openaiLog.error({ err: msg }, '[OpenAI] Error transcribiendo audio')
    return { ok: false, errorCode: 'api_error', errorMessage: msg }
  }
}

// ── Embeddings ──────────────────────────────────────────────────────────────

export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const oai = getClient()
    const res = await oai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    return res.data[0]?.embedding ?? null
  } catch (err) {
    openaiLog.error({ err: (err as Error).message }, '[OpenAI] Error obteniendo embedding')
    return null
  }
}

// ── Vision (analizar imagen) ────────────────────────────────────────────────

export async function analyzeImage(imageUrl: string, prompt: string): Promise<ChatResult> {
  try {
    const oai = getClient()
    const res = await oai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role:    'user',
          content: [
            { type: 'text',      text: prompt },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ],
      max_tokens: 512,
    })
    const text = res.choices[0]?.message?.content ?? ''
    openaiLog.info('[OpenAI] Imagen analizada')
    return { ok: true, text }
  } catch (err) {
    const msg = (err as Error).message
    openaiLog.error({ err: msg }, '[OpenAI] Error analizando imagen')
    return { ok: false, errorMessage: msg }
  }
}

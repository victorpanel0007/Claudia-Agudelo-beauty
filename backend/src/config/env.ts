import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const envSchema = z.object({
  // Railway asigna PORT dinamicamente — usar su valor
  PORT:      z.string().default('8080'),
  NODE_ENV:  z.enum(['development', 'production', 'test']).default('development'),
  TIMEZONE:  z.string().default('America/Bogota'),
  FRONTEND_URL: z.string().default('https://www.claudiaagudelobeauty.sbs'),

  // Supabase — mismos nombres que el SPA en Vercel
  NEXT_PUBLIC_SUPABASE_URL:  z.string().url().optional(),
  SUPABASE_URL:              z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),

  // OpenAI — misma clave que el SPA
  OPENAI_API_KEY:             z.string().min(10),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default('whisper-1'),

  // Dualhook — webhooks entrantes
  DUALHOOK_API_KEY:         z.string().default(''),
  DUALHOOK_VERIFY_TOKEN:    z.string().default('changeme'),
  DUALHOOK_WEBHOOK_SECRET:  z.string().default('changeme'),
  DUALHOOK_PHONE_NUMBER_ID: z.string().default(''),

  // Meta Cloud API — token para ENVIAR mensajes (graph.facebook.com)
  META_ACCESS_TOKEN:        z.string().default(''),

  // Cron
  CRON_SECRET: z.string().default('dev-cron-secret'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Variables de entorno invalidas:')
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  process.exit(1)
}

const raw = parsed.data

const supabaseUrl = raw.NEXT_PUBLIC_SUPABASE_URL ?? raw.SUPABASE_URL
if (!supabaseUrl) {
  console.error('Debes definir NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL')
  process.exit(1)
}

export const env = {
  ...raw,
  SUPABASE_URL: supabaseUrl,
  PORT:         parseInt(raw.PORT, 10),
  IS_PROD:      raw.NODE_ENV === 'production',
  IS_DEV:       raw.NODE_ENV === 'development',
} as const

export type Env = typeof env

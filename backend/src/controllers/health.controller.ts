import { Request, Response } from 'express'
import { checkSupabaseConnection } from '../database/supabase'
import { chat } from '../services/openai.service'
import { sendText } from '../services/whatsapp.service'
import { processBotMessage } from '../services/bot.engine'
import { env } from '../config/env'
import { webhookLog } from '../config/logger'

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const supabaseOk = await checkSupabaseConnection()
  const status = supabaseOk ? 200 : 503
  res.status(status).json({
    ok:          supabaseOk,
    service:     'claudia-beauty-backend',
    version:     '1.0.0',
    environment: env.NODE_ENV,
    timezone:    env.TIMEZONE,
    supabase:    supabaseOk ? 'connected' : 'error',
    dualhook_configured: !!(env.DUALHOOK_API_KEY && env.DUALHOOK_API_KEY !== '' && env.DUALHOOK_PHONE_NUMBER_ID && env.DUALHOOK_PHONE_NUMBER_ID !== ''),
    openai_configured:   !!(env.OPENAI_API_KEY && env.OPENAI_API_KEY.startsWith('sk-')),
    timestamp:   new Date().toISOString(),
    hora_colombia: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
  })
}

export function rootHandler(_req: Request, res: Response): void {
  res.json({
    service:  'Claudia Beauty Backend',
    version:  '1.0.0',
    docs:     '/health',
    webhook:  '/webhooks/dualhook',
  })
}

export function versionHandler(_req: Request, res: Response): void {
  res.json({ version: '1.0.0', node: process.version, env: env.NODE_ENV })
}

export async function testOpenAI(_req: Request, res: Response): Promise<void> {
  const result = await chat({
    messages: [{ role: 'user', content: 'Di exactamente: OK' }],
    maxTokens: 10,
  })
  res.json({ ok: result.ok, response: result.text, error: result.errorMessage })
}

/**
 * GET /api/test/supabase
 * Prueba las tablas que usa el bot directamente.
 */
export async function testSupabase(_req: Request, res: Response): Promise<void> {
  const { getSupabase } = await import('../database/supabase')
  const sb = getSupabase()
  const results: Record<string, unknown> = {}

  const tables = ['conversaciones_bot', 'mensajes_whatsapp', 'bot_pausas', 'categorias', 'servicios', 'especialistas', 'clientes']
  for (const t of tables) {
    const { error } = await sb.from(t).select('id').limit(1)
    results[t] = error ? `❌ ${error.message}` : '✅ OK'
  }
  res.json(results)
}

/**
 * POST /api/test/bot
 * Simula un mensaje entrante de WhatsApp sin necesitar DualHook.
 */
export async function testBot(req: Request, res: Response): Promise<void> {
  const { telefono, mensaje } = req.body as { telefono?: string; mensaje?: string }
  if (!telefono || !mensaje) {
    res.status(400).json({ error: 'Se requieren "telefono" y "mensaje"' })
    return
  }
  webhookLog.info({ telefono, mensaje }, '[TestBot] Simulando mensaje entrante')
  try {
    await processBotMessage(telefono, mensaje)
    webhookLog.info({ telefono }, '[TestBot] ✅ Bot procesó el mensaje correctamente')
    res.json({ ok: true, message: 'Bot procesó el mensaje. Revisa los logs para ver el flujo completo.' })
  } catch (err) {
    const error = err as Error
    webhookLog.error({ err: error.message, stack: error.stack }, '[TestBot] ❌ Error')
    res.status(500).json({ ok: false, error: error.message, stack: error.stack })
  }
}

/**
 * POST /api/test/send
 * Prueba el envío directo de un mensaje de WhatsApp vía DualHook.
 * Body: { telefono: "573001234567", mensaje: "Hola prueba" }
 */
export async function testSend(req: Request, res: Response): Promise<void> {
  const { telefono, mensaje } = req.body as { telefono?: string; mensaje?: string }
  if (!telefono || !mensaje) {
    res.status(400).json({ error: 'Se requieren "telefono" y "mensaje"' })
    return
  }
  webhookLog.info({ telefono, mensaje }, '[TestSend] Enviando mensaje de prueba')
  const result = await sendText({ to: telefono, text: mensaje })
  webhookLog.info({ result }, '[TestSend] Resultado envío')
  res.json(result)
}

/**
 * GET /api/test/config
 * Muestra el estado de las variables de entorno (sin exponer valores secretos).
 */
export async function testConfig(_req: Request, res: Response): Promise<void> {
  const supabaseOk = await checkSupabaseConnection()
  res.json({
    supabase: {
      url:       env.SUPABASE_URL ? env.SUPABASE_URL.slice(0, 40) + '...' : '❌ NO CONFIGURADO',
      service_key: env.SUPABASE_SERVICE_ROLE_KEY ? '✅ configurado (' + env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 8) + '...)' : '❌ NO CONFIGURADO',
      connected: supabaseOk,
    },
    openai: {
      api_key: env.OPENAI_API_KEY ? '✅ configurado (' + env.OPENAI_API_KEY.slice(0, 8) + '...)' : '❌ NO CONFIGURADO',
    },
    dualhook: {
      api_key:        env.DUALHOOK_API_KEY        ? '✅ configurado (' + env.DUALHOOK_API_KEY.slice(0, 8) + '...)'        : '❌ NO CONFIGURADO',
      phone_number_id: env.DUALHOOK_PHONE_NUMBER_ID ? '✅ ' + env.DUALHOOK_PHONE_NUMBER_ID : '❌ NO CONFIGURADO',
      verify_token:   env.DUALHOOK_VERIFY_TOKEN   !== 'changeme' ? '✅ configurado' : '⚠️  usando valor por defecto "changeme"',
      webhook_secret: env.DUALHOOK_WEBHOOK_SECRET !== 'changeme' ? '✅ configurado' : '⚠️  usando valor por defecto "changeme"',
    },
    frontend_url: env.FRONTEND_URL,
    node_env:     env.NODE_ENV,
    port:         env.PORT,
  })
}

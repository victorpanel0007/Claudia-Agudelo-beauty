// Backend Claudia Beauty — Dualhook + Meta Cloud API v25.0
import { env } from './config/env'
import { logger } from './config/logger'
import app from './app'
import { checkSupabaseConnection } from './database/supabase'
import { initCronJobs } from './cron'

async function bootstrap(): Promise<void> {
  logger.info({ env: env.NODE_ENV, port: env.PORT }, 'Iniciando Claudia Beauty Backend...')

  // Verificar conexion a Supabase (misma BD que el SPA)
  const sbOk = await checkSupabaseConnection()
  if (!sbOk) {
    logger.warn('Supabase no disponible al inicio — continuando de todas formas')
  }

  // Iniciar cron jobs
  initCronJobs()

  // Arrancar servidor
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, url: `http://localhost:${env.PORT}` }, '✅ Servidor listo')
    logger.info({ supabase: env.SUPABASE_URL.slice(0, 40) + '...' }, '📦 Supabase conectado')
    logger.info('📱 Webhook Dualhook: /webhooks/dualhook')
  })

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Apagando servidor...')
    server.close(() => {
      logger.info('Servidor cerrado correctamente')
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10_000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
  process.on('uncaughtException',  err => logger.error({ err: err.message }, 'uncaughtException'))
  process.on('unhandledRejection', err => logger.error({ err },              'unhandledRejection'))
}

bootstrap()

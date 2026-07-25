import pino from 'pino'
import { env } from './env'

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
    : undefined,
})

export const httpLogger  = logger.child({ module: 'HTTP' })
export const webhookLog  = logger.child({ module: 'Webhook' })
export const dualhookLog = logger.child({ module: 'Dualhook' })
export const openaiLog   = logger.child({ module: 'OpenAI' })
export const supabaseLog = logger.child({ module: 'Supabase' })
export const cronLog     = logger.child({ module: 'Cron' })

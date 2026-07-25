import { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import compression from 'compression'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
import { env } from '../config/env'
import { logger } from '../config/logger'

// ── Helmet ───────────────────────────────────────────────────────────────────
export const helmetMiddleware = helmet()

// ── Compression ──────────────────────────────────────────────────────────────
export const compressionMiddleware = compression()

// ── CORS ─────────────────────────────────────────────────────────────────────
export const corsMiddleware = cors({
  origin:      [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'],
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
})

// ── Rate Limit ───────────────────────────────────────────────────────────────
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max:      200,
  message:  { error: 'Demasiadas solicitudes. Intenta en unos minutos.' },
  standardHeaders: true,
  legacyHeaders:   false,
})

export const webhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max:      500,
  message:  { error: 'Rate limit webhook' },
})

// ── HTTP Logger ───────────────────────────────────────────────────────────────
export const httpLoggerMiddleware = pinoHttp({ logger })

// ── Error Handler ─────────────────────────────────────────────────────────────
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err: err.message, stack: err.stack }, 'Error no manejado')
  res.status(500).json({
    error:   'Error interno del servidor',
    message: err.message,
    stack:   env.NODE_ENV !== 'production' ? err.stack : undefined,
  })
}

// ── Not Found ────────────────────────────────────────────────────────────────
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Ruta no encontrada' })
}

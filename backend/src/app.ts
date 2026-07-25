import express from 'express'
import {
  helmetMiddleware,
  compressionMiddleware,
  corsMiddleware,
  rateLimitMiddleware,
  httpLoggerMiddleware,
  errorHandler,
  notFoundHandler,
} from './middleware'
import routes from './routes'

const app = express()

// ── Middleware de seguridad y utilidades ─────────────────────────────────────
app.use(helmetMiddleware)
app.use(compressionMiddleware)
app.use(corsMiddleware)
app.use(rateLimitMiddleware)

// ── Logging HTTP ─────────────────────────────────────────────────────────────
app.use(httpLoggerMiddleware)

// ── Body parser ──────────────────────────────────────────────────────────────
// Guardar rawBody para validacion de firma del webhook
app.use(express.json({
  limit: '5mb',
  verify: (req: express.Request & { rawBody?: string }, _res, buf) => {
    req.rawBody = buf.toString('utf8')
  },
}))

// ── Rutas ────────────────────────────────────────────────────────────────────
app.use('/', routes)

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use(notFoundHandler)

// ── Error handler global ─────────────────────────────────────────────────────
app.use(errorHandler)

export default app

import { Router } from 'express'
import { healthCheck, rootHandler, versionHandler, testOpenAI, testBot, testSend, testConfig, testSupabase } from '../controllers/health.controller'
import { verifyWebhook, receiveWebhook } from '../controllers/webhook.controller'
import { sendMessage, sendImageMessage, sendAudioMessage, sendDocumentMessage, sendLocationMessage } from '../controllers/messages.controller'
import { webhookRateLimit } from '../middleware'

const router = Router()

// ── Raiz y health ────────────────────────────────────────────────────────────
router.get('/',            rootHandler)
router.get('/health',      healthCheck)
router.get('/api/version', versionHandler)

// ── Webhook Dualhook ─────────────────────────────────────────────────────────
router.get('/webhooks/dualhook',  webhookRateLimit, verifyWebhook)
router.post('/webhooks/dualhook', webhookRateLimit, receiveWebhook)

// ── Mensajes salientes ───────────────────────────────────────────────────────
router.post('/api/messages/send',     sendMessage)
router.post('/api/messages/image',    sendImageMessage)
router.post('/api/messages/audio',    sendAudioMessage)
router.post('/api/messages/document', sendDocumentMessage)
router.post('/api/messages/location', sendLocationMessage)

// ── Test y diagnóstico ────────────────────────────────────────────────────────
router.post('/api/test/openai', testOpenAI)
router.post('/api/test/bot',    testBot)    // Simula mensaje entrante sin DualHook
router.post('/api/test/send',   testSend)   // Prueba envío directo a número real
router.get('/api/test/config',    testConfig) // Muestra estado de variables de entorno
router.get('/api/test/supabase',  testSupabase) // Prueba tablas de Supabase

export default router

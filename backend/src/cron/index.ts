/**
 * Cron Jobs — estructura preparada, implementación pendiente.
 * Lógica de recordatorios, limpieza y reintentos se añadirá aquí.
 */
import cron from 'node-cron'
import { cronLog } from '../config/logger'

export function initCronJobs(): void {
  // ── Recordatorios 24h ─────────────────────────────────────────────────────
  // Se ejecuta cada hora en zona America/Bogota
  cron.schedule('0 * * * *', async () => {
    cronLog.info('[Cron] Verificando recordatorios 24h...')
    // TODO: implementar logica de recordatorios reutilizando
    // la misma logica del SPA (tabla config_recordatorios + citas)
  }, { timezone: 'America/Bogota' })

  // ── Limpieza de conversaciones expiradas ──────────────────────────────────
  cron.schedule('0 3 * * *', async () => {
    cronLog.info('[Cron] Limpieza de conversaciones expiradas...')
    // TODO: limpiar conversaciones_bot con updated_at > 2h
  }, { timezone: 'America/Bogota' })

  // ── Limpieza de pausas vencidas ───────────────────────────────────────────
  cron.schedule('*/10 * * * *', async () => {
    // Cada 10 minutos — silencioso
  }, { timezone: 'America/Bogota' })

  cronLog.info('[Cron] Jobs inicializados')
}

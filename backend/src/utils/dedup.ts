/**
 * Deduplicación de mensajes entrantes.
 * Evita procesar el mismo mensaje dos veces (webhook retry de Meta).
 * Cache en memoria con TTL de 10 minutos.
 */

const seen = new Map<string, number>()
const TTL_MS = 10 * 60 * 1000

export function isDuplicate(messageId: string): boolean {
  const now = Date.now()
  // Limpiar entradas expiradas
  for (const [id, ts] of seen.entries()) {
    if (now - ts > TTL_MS) seen.delete(id)
  }
  if (seen.has(messageId)) return true
  seen.set(messageId, now)
  return false
}

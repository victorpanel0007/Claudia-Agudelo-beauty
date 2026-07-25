import crypto from 'crypto'

/**
 * Valida la firma HMAC-SHA256 del webhook de Dualhook/Meta.
 * Retorna true si la firma es válida.
 */
export function validateWebhookSignature(
  rawBody:   string,
  signature: string,
  secret:    string
): boolean {
  if (!signature) return false
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  } catch {
    return false
  }
}

import crypto from 'crypto'

// Tokens HMAC para enlaces públicos sin sesión (firma de reportes, portal de soporte).
// No se guardan en la BD: se recalculan con el secreto del servidor, así un enlace
// solo sirve para el registro para el que se generó y no se puede adivinar.

function secreto(): string {
  const base = process.env.FIRMA_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('Falta FIRMA_SECRET o SUPABASE_SERVICE_ROLE_KEY')
  return base
}

/** Token de 32 caracteres para `proposito:id` (p. ej. "firma-cliente:102") */
export function tokenPara(proposito: string, id: number | string): string {
  return crypto
    .createHmac('sha256', secreto())
    .update(`${proposito}:${id}`)
    .digest('base64url')
    .slice(0, 32)
}

export function tokenValido(proposito: string, id: number | string, token: unknown): boolean {
  if (typeof token !== 'string' || token.length !== 32) return false
  const esperado = Buffer.from(tokenPara(proposito, id))
  const recibido = Buffer.from(token)
  return esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido)
}

/**
 * Origen público (https://dominio) a partir del request. Detrás del proxy de Render
 * req.url apunta al puerto interno, así que se usan los encabezados reenviados.
 */
export function origenPublico(req: Request): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    ?? (host?.startsWith('localhost') ? 'http' : 'https')
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
}

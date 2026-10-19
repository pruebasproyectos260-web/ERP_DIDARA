import crypto from 'crypto'

// Enlace público de firma: /firma-cliente?id=<reporte>&t=<token>
// El token es un HMAC del id del reporte, así el cliente solo puede firmar SU reporte
// y nadie puede adivinar enlaces de otros. No requiere guardar nada en la BD.

function secreto(): string {
  const base = process.env.FIRMA_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('Falta FIRMA_SECRET o SUPABASE_SERVICE_ROLE_KEY')
  return base
}

export function tokenFirma(reporteId: number | string): string {
  return crypto
    .createHmac('sha256', secreto())
    .update(`firma-cliente:${reporteId}`)
    .digest('base64url')
    .slice(0, 32)
}

export function tokenFirmaValido(reporteId: number | string, token: unknown): boolean {
  if (typeof token !== 'string' || token.length !== 32) return false
  const esperado = Buffer.from(tokenFirma(reporteId))
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

export function urlFirma(req: Request, reporteId: number | string): string {
  return `${origenPublico(req)}/firma-cliente?id=${reporteId}&t=${tokenFirma(reporteId)}`
}

// Firma dibujada en canvas (PNG en base64). ~400 KB es de sobra para 380×180 px.
export const MAX_LARGO_FIRMA = 400_000

export function firmaValida(firma: unknown): firma is string {
  return typeof firma === 'string'
    && firma.startsWith('data:image/png;base64,')
    && firma.length <= MAX_LARGO_FIRMA
    && /^[A-Za-z0-9+/=]+$/.test(firma.slice('data:image/png;base64,'.length))
}

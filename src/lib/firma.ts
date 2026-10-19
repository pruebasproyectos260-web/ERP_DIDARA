import { origenPublico, tokenPara, tokenValido } from './tokens'

// Enlace público de firma: /firma-cliente?id=<reporte>&t=<token>
// El token es un HMAC del id del reporte, así el cliente solo puede firmar SU reporte
// y nadie puede adivinar enlaces de otros. No requiere guardar nada en la BD.

export { origenPublico }

export const tokenFirma = (reporteId: number | string) => tokenPara('firma-cliente', reporteId)
export const tokenFirmaValido = (reporteId: number | string, token: unknown) => tokenValido('firma-cliente', reporteId, token)

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

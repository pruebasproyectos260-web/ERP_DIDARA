import { origenPublico, tokenPara, tokenValido } from './tokens'

// Enlace del portal de soporte de cada cliente: /soporte?c=<id>&t=<token>.
// El token identifica al cliente: los tickets que levante desde ahí quedan a su nombre.

export const tokenPortal = (clienteId: number | string) => tokenPara('portal-soporte', clienteId)
export const tokenPortalValido = (clienteId: number | string, token: unknown) => tokenValido('portal-soporte', clienteId, token)

export function urlPortal(req: Request, clienteId: number | string) {
  return `${origenPublico(req)}/soporte?c=${clienteId}&t=${tokenPortal(clienteId)}`
}

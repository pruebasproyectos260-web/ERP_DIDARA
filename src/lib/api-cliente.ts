// Helpers de fetch para componentes cliente.
import { aviso } from '@/components/ui/Avisos'

/** Mensaje de error del cuerpo JSON de una respuesta fallida. */
export async function mensajeError(res: Response, porDefecto: string): Promise<string> {
  const json = await res.json().catch(() => ({}))
  return typeof json?.error === 'string' && json.error ? json.error : porDefecto
}

/**
 * DELETE que avisa si el servidor lo rechazó (permisos, red, etc.) o si se eliminó.
 * Devuelve true solo si se eliminó: úsalo antes de quitar el elemento de la pantalla.
 */
export async function borrar(url: string, porDefecto = 'No se pudo eliminar', exito = 'Eliminado correctamente'): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'DELETE' })
    if (res.ok) {
      aviso.exito(exito)
      return true
    }
    aviso.error(await mensajeError(res, porDefecto))
  } catch {
    aviso.error('Error de red. Revisa tu conexión e intenta de nuevo.')
  }
  return false
}

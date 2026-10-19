// Helpers de fetch para componentes cliente.

/** Mensaje de error del cuerpo JSON de una respuesta fallida. */
async function mensajeError(res: Response, porDefecto: string): Promise<string> {
  const json = await res.json().catch(() => ({}))
  return typeof json?.error === 'string' && json.error ? json.error : porDefecto
}

/**
 * DELETE que avisa si el servidor lo rechazó (permisos, red, etc.).
 * Devuelve true solo si se eliminó: úsalo antes de quitar el elemento de la pantalla.
 */
export async function borrar(url: string, porDefecto = 'No se pudo eliminar'): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'DELETE' })
    if (res.ok) return true
    alert(await mensajeError(res, porDefecto))
  } catch {
    alert('Error de red. Revisa tu conexión e intenta de nuevo.')
  }
  return false
}

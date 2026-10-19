import type { Sesion } from '@/lib/auth'

type Tabla = 'cotizacion_items' | 'reporte_items'
type Fk = 'cotizacion_id' | 'reporte_id'

/**
 * Reemplaza las partidas de una cotización/reporte sin riesgo de dejarla vacía:
 * primero inserta las nuevas y solo si eso funciona borra las anteriores.
 * Devuelve el mensaje de error o null si todo salió bien.
 */
export async function reemplazarPartidas(
  supabase: Sesion['supabase'],
  tabla: Tabla,
  fk: Fk,
  id: string | number,
  items: Record<string, unknown>[],
): Promise<string | null> {
  const { data: anteriores, error: errLeer } = await supabase.from(tabla).select('id').eq(fk, id)
  if (errLeer) return errLeer.message

  if (items.length > 0) {
    const { error: errInsertar } = await supabase.from(tabla).insert(items.map((it) => ({ ...it, [fk]: id })))
    // Si falla, las partidas anteriores siguen intactas
    if (errInsertar) return `No se pudieron guardar las partidas: ${errInsertar.message}`
  }

  const ids = (anteriores ?? []).map((a) => a.id)
  if (ids.length > 0) {
    const { error: errBorrar } = await supabase.from(tabla).delete().in('id', ids)
    if (errBorrar) return `Las partidas nuevas se guardaron pero no se pudieron quitar las anteriores: ${errBorrar.message}`
  }

  return null
}

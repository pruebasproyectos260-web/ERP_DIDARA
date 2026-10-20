import { NIVEL } from '@/lib/nivel'

// Visibilidad de la agenda:
// - Niveles 0 y 1 ven todos los eventos (pero solo se les avisa de los suyos).
// - El resto ve solo los eventos donde es encargado, o que creó él mismo.
// Los encargados se guardan como nombres separados por coma en eventos.responsables.

/** Compara nombres sin importar mayúsculas, acentos ni espacios de más */
export const normalizarNombre = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

export function esEncargado(responsables: string | null | undefined, nombre: string | null | undefined) {
  if (!responsables || !nombre) return false
  const yo = normalizarNombre(nombre)
  return responsables.split(',').some((r) => normalizarNombre(r) === yo)
}

export function puedeVerEvento(
  evento: { responsables: string | null; responsable_id: string | null },
  usuario: { userId: string; nombre: string; nivel: number },
) {
  return usuario.nivel <= NIVEL.ADMIN
    || esEncargado(evento.responsables, usuario.nombre)
    || evento.responsable_id === usuario.userId // quien lo creó
}

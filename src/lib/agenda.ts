import { NIVEL } from '@/lib/nivel'

// Visibilidad de la agenda:
// - Niveles 0 y 1 ven todos los eventos (pero solo se les avisa de los suyos).
// - El resto ve solo los eventos donde es encargado, o que creó él mismo.
// Los encargados se guardan como nombres separados por coma en eventos.responsables.

// ── Horas de los eventos ───────────────────────────────────────────────────
// La Agenda guarda la hora tal como se capturó (hora de México) en un campo con zona UTC:
// "9:30" queda como 09:30 UTC. Para no mover los eventos que ya existen, siempre se lee así
// ("hora de pared"), sin convertir de zona horaria.

const dos = (n: number) => String(n).padStart(2, '0')

/** Fecha/hora del evento tal como se capturó, como Date local (para mostrar y comparar en pantalla) */
export function fechaEvento(iso: string): Date {
  const d = new Date(iso)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds())
}

/** 'YYYY-MM-DD' de una fecha local (sin pasar por UTC) */
export const diaISO = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`

/** Ahora mismo en México como 'YYYY-MM-DDTHH:mm' (para comparar con la hora guardada de los eventos) */
export function ahoraMexico(): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

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

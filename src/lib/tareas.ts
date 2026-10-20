import crypto from 'crypto'
import type { Sesion } from '@/lib/auth'
import { esEncargado } from '@/lib/agenda'
import { enviarPush } from '@/lib/push'
import { rangoMes, sumarMeses } from '@/lib/finanzas'
import { enviarReporteContable } from '@/lib/contabilidad-correo'

// Tareas que corren solas: Supabase (pg_cron) visita /api/cron cada 15 minutos.
// Cada aviso se registra en "avisos_enviados" para que nunca salga dos veces.

type Supabase = Sesion['supabase']

/** Clave del enlace de tareas. Se deriva de la llave de Supabase (igual en local y en Render). */
export function tokenTareas() {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!llave) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  return crypto.createHmac('sha256', llave).update('tareas-programadas').digest('base64url').slice(0, 32)
}

export function tokenTareasValido(t: unknown) {
  if (typeof t !== 'string' || t.length !== 32) return false
  const a = Buffer.from(tokenTareas())
  const b = Buffer.from(t)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// En pruebas locales las marcas llevan otro prefijo: así una prueba nunca da por "enviado"
// un aviso real (en pruebas los push solo llegan a cuentas zz_prueba_, ver lib/push.ts)
const PREFIJO = process.env.CORREO_DESACTIVADO === '1' ? 'prueba:' : ''

/** true solo la primera vez que se registra la clave (evita avisos repetidos) */
async function primeraVez(supabase: Supabase, clave: string) {
  const { error } = await supabase.from('avisos_enviados').insert({ clave: PREFIJO + clave })
  return !error
}

/** 'YYYY-MM-DDTHH:mm' → minutos (para restar horas "de pared") */
const minutos = (s: string) => Date.parse(`${s.slice(0, 16)}:00Z`) / 60000
const hhmm = (iso: string) => iso.slice(11, 16)

/**
 * Recordatorios de la Agenda para los ENCARGADOS de cada evento:
 * - A partir de las 5 am: "Hoy tienes N eventos" (uno por persona al día).
 * - 2 horas antes de cada evento con hora.
 */
export async function recordatoriosAgenda(supabase: Supabase, ahora: string) {
  const hoy = ahora.slice(0, 10)
  const [{ data: eventos }, { data: usuarios }] = await Promise.all([
    supabase.from('eventos').select('id, titulo, fecha_inicio, todo_el_dia, estado, responsables, lugar, cliente:clientes(nombre)')
      .gte('fecha_inicio', `${hoy}T00:00:00`).lte('fecha_inicio', `${hoy}T23:59:59`)
      .not('estado', 'in', '("Completado","Cancelado")').order('fecha_inicio'),
    supabase.from('usuarios').select('id, nombre').eq('activo', true),
  ])
  const encargados = (ev: { responsables: string | null }) =>
    (usuarios ?? []).filter((u) => esEncargado(ev.responsables, u.nombre)).map((u) => u.id as string)
  const enviados = { resumenDia: 0, dosHoras: 0 }

  // Resumen del día (desde las 5 am)
  if (Number(ahora.slice(11, 13)) >= 5) {
    const porPersona = new Map<string, NonNullable<typeof eventos>>()
    for (const ev of eventos ?? []) for (const id of encargados(ev)) porPersona.set(id, [...(porPersona.get(id) ?? []), ev])
    for (const [id, lista] of porPersona) {
      if (!(await primeraVez(supabase, `agenda-dia:${hoy}:${id}`))) continue
      const n = lista.length
      await enviarPush(supabase, [id], {
        titulo: `📅 Hoy tienes ${n} evento${n === 1 ? '' : 's'}`,
        cuerpo: lista.map((ev) => `${ev.todo_el_dia ? 'Todo el día' : hhmm(ev.fecha_inicio)} ${ev.titulo}`).join(' · '),
        url: '/agenda',
        etiqueta: `agenda-dia-${hoy}`,
      })
      enviados.resumenDia++
    }
  }

  // 2 horas antes
  const ya = minutos(ahora)
  for (const ev of eventos ?? []) {
    if (ev.todo_el_dia) continue
    const faltan = minutos(ev.fecha_inicio) - ya
    if (faltan <= 0 || faltan > 120) continue
    const ids = encargados(ev)
    if (!ids.length || !(await primeraVez(supabase, `agenda-2h:${ev.id}:${ev.fecha_inicio.slice(0, 16)}`))) continue
    const cliente = (Array.isArray(ev.cliente) ? ev.cliente[0] : ev.cliente) as { nombre?: string } | null
    await enviarPush(supabase, ids, {
      titulo: `⏰ ${faltan >= 105 ? 'En 2 horas' : `En ${faltan >= 60 ? `${Math.floor(faltan / 60)} h ${faltan % 60} min` : `${faltan} min`}`}: ${ev.titulo}`,
      cuerpo: [hhmm(ev.fecha_inicio), ev.lugar, cliente?.nombre].filter(Boolean).join(' · '),
      url: '/agenda',
      etiqueta: `evento-${ev.id}`,
    })
    enviados.dosHoras++
  }
  return enviados
}

/** Día 1 desde las 8 am: manda a contabilidad el Excel del mes anterior (una sola vez) */
export async function envioContableMensual(supabase: Supabase, origen: string, ahora: string) {
  if (ahora.slice(8, 10) !== '01' || Number(ahora.slice(11, 13)) < 8) return null
  const mes = sumarMeses(ahora.slice(0, 7), -1)
  const clave = `contabilidad:${mes}`
  if (!(await primeraVez(supabase, clave))) return null
  try {
    const { desde, hasta } = rangoMes(mes)
    return await enviarReporteContable(supabase, origen, desde, hasta)
  } catch (e) {
    // Si falló, se libera la marca para reintentar en la siguiente vuelta
    await supabase.from('avisos_enviados').delete().eq('clave', PREFIJO + clave)
    throw e
  }
}

/** Una vez al día: borra marcas de avisos de hace más de 90 días */
export async function limpiezaAvisos(supabase: Supabase, ahora: string) {
  if (!(await primeraVez(supabase, `limpieza:${ahora.slice(0, 10)}`))) return
  await supabase.from('avisos_enviados').delete().lt('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
}

import crypto from 'crypto'
import { requireNivel, type Sesion } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { recurrenteVigente, sumarMeses, vencimiento } from '@/lib/finanzas'
import { CATEGORIA_TRABAJO, ETIQUETA_TRABAJO, type Ambito, type TipoTrabajo } from '@/lib/transportes'

// Transportes (TCG): todo es solo del super admin (nivel 0). A propósito NO se anota en el
// registro de actividad: ese lo ven los administradores de nivel 1.

export const soloSuperAdmin = () => requireNivel(NIVEL.SUPER_ADMIN)

export const SELECT_GASTO_TCG = '*, camion:tcg_camiones(id, nombre), trabajo:tcg_trabajos(id, tipo)'
export const SELECT_TRABAJO = '*, gasto:tcg_gastos(id, metodo_pago, con_factura, iva, comprobantes)'

interface DatosTrabajo {
  camion_id: number
  fecha: string
  tipo: TipoTrabajo
  descripcion: string
  taller: string | null
  costo: number
  gasto_id: number | null
}
interface DatosPago {
  metodo_pago: string | null
  con_factura: boolean
  iva: number | null
  comprobantes: string[]
}

/**
 * Un trabajo que costó algo tiene su gasto de la empresa (categoría Mantenimiento, ligado al camión).
 * Crea, actualiza o borra ese gasto según el costo. Devuelve el id del gasto (o null).
 */
export async function sincronizarGastoTrabajo(supabase: Sesion['supabase'], t: DatosTrabajo, pago: DatosPago): Promise<number | null> {
  if (t.costo <= 0) {
    if (t.gasto_id) {
      const { data: g } = await supabase.from('tcg_gastos').delete().eq('id', t.gasto_id).select('comprobantes').single()
      if (g?.comprobantes?.length) await supabase.storage.from('documentos').remove(g.comprobantes)
    }
    // Sin costo no hay gasto: las fotos que se hayan subido no tienen dónde quedarse
    if (pago.comprobantes.length) await supabase.storage.from('documentos').remove(pago.comprobantes)
    return null
  }

  const gasto = {
    ambito: 'empresa',
    fecha: t.fecha,
    categoria: CATEGORIA_TRABAJO,
    descripcion: `${ETIQUETA_TRABAJO[t.tipo]} · ${t.descripcion}`.slice(0, 300),
    proveedor: t.taller,
    monto: t.costo,
    metodo_pago: pago.metodo_pago,
    con_factura: pago.con_factura,
    iva: pago.con_factura && pago.iva != null ? Math.min(pago.iva, t.costo) : null,
    comprobantes: pago.comprobantes,
    camion_id: t.camion_id,
    updated_at: new Date().toISOString(),
  }
  if (t.gasto_id) {
    const { data: previo } = await supabase.from('tcg_gastos').select('comprobantes').eq('id', t.gasto_id).single()
    const { error } = await supabase.from('tcg_gastos').update(gasto).eq('id', t.gasto_id)
    if (error) throw error
    const quitados = ((previo?.comprobantes ?? []) as string[]).filter((r) => !pago.comprobantes.includes(r))
    if (quitados.length) await supabase.storage.from('documentos').remove(quitados)
    return t.gasto_id
  }
  const { data, error } = await supabase.from('tcg_gastos').insert(gasto).select('id').single()
  if (error) throw error
  return data.id
}

export interface FijoPorPagar { id: number; ambito: Ambito; nombre: string; monto: number; mes: string; vence: string; diasRestantes: number }

/**
 * Gastos fijos de Transportes sin pagar que ya vencieron o vencen en `dias` días o menos.
 * Revisa el mes en curso y el anterior (lo de el mes pasado que no se pagó sigue pendiente).
 */
export async function fijosPorPagar(supabase: Sesion['supabase'], hoy: string, dias = 5): Promise<FijoPorPagar[]> {
  const mes = hoy.slice(0, 7), anterior = sumarMeses(mes, -1)
  const [{ data: fijos, error }, { data: pagos }] = await Promise.all([
    supabase.from('tcg_fijos').select('id, ambito, nombre, monto, dia, desde, hasta'),
    supabase.from('tcg_gastos').select('fijo_id, mes_fijo').in('mes_fijo', [anterior, mes]).not('fijo_id', 'is', null),
  ])
  if (error) return [] // sin la migración de fijos todavía
  const pagado = new Set((pagos ?? []).map((p) => `${p.fijo_id}|${p.mes_fijo}`))
  const dia = (f: string) => Date.parse(`${f}T12:00:00Z`) / 86_400_000
  const lista: FijoPorPagar[] = []
  for (const f of fijos ?? []) {
    for (const m of [anterior, mes]) {
      if (!recurrenteVigente(f, m) || pagado.has(`${f.id}|${m}`)) continue
      const vence = vencimiento(m, f.dia)
      const diasRestantes = Math.round(dia(vence) - dia(hoy))
      if (diasRestantes <= dias) lista.push({ id: f.id, ambito: f.ambito, nombre: f.nombre, monto: Number(f.monto), mes: m, vence, diasRestantes })
    }
  }
  return lista.sort((a, b) => a.diasRestantes - b.diasRestantes)
}

/** Clave con la que la Raspberry manda la asistencia de TALONES/REMI. Se deriva de la llave de Supabase. */
export function tokenAsistencia() {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!llave) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  return crypto.createHmac('sha256', llave).update('tcg-asistencia').digest('base64url').slice(0, 32)
}

export function tokenAsistenciaValido(t: unknown) {
  if (typeof t !== 'string' || t.length !== 32) return false
  const a = Buffer.from(tokenAsistencia())
  const b = Buffer.from(t)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

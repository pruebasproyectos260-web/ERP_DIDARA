import crypto from 'crypto'
import { requireNivel, type Sesion } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CATEGORIA_TRABAJO, ETIQUETA_TRABAJO, type TipoTrabajo } from '@/lib/transportes'

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

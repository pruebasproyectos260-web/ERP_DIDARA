import crypto from 'crypto'
import { requireNivel, type Sesion } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { sumarMeses, vencimiento } from '@/lib/finanzas'
import {
  AMBITO_DE_USO, CATEGORIA_TRABAJO, ETIQUETA_DOCUMENTO, ETIQUETA_TRABAJO, diasEntre, estadoAceite, estadoVencimiento, fijoAplica,
  type Ambito, type Camion, type EstadoAceite, type EstadoVencimiento, type TipoDocumento, type TipoTrabajo, type Uso,
} from '@/lib/transportes'

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
 * Un trabajo que costó algo tiene su gasto: de la empresa (Mantenimiento) si es camión, del hogar
 * (Vehículo) si es carro de la familia; ligado al vehículo.
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

  const { data: vehiculo } = await supabase.from('tcg_camiones').select('uso').eq('id', t.camion_id).single()
  const uso: Uso = vehiculo?.uso === 'familia' ? 'familia' : 'empresa'
  const gasto = {
    ambito: AMBITO_DE_USO[uso],
    fecha: t.fecha,
    categoria: CATEGORIA_TRABAJO[uso],
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

export interface FijoPorPagar {
  id: number; ambito: Ambito; nombre: string; monto: number; mes: string; vence: string; diasRestantes: number; cada_meses: number
}

/** Los que no son mensuales (seguros, tenencia…) avisan con más anticipación */
export const DIAS_AVISO_NO_MENSUAL = 15

/**
 * Gastos fijos de Transportes sin pagar que ya vencieron o vencen pronto: en `dias` días o menos
 * (o 15 si no son mensuales). Revisa el mes anterior (lo que no se pagó sigue pendiente), el actual y el siguiente.
 */
export async function fijosPorPagar(supabase: Sesion['supabase'], hoy: string, dias = 5): Promise<FijoPorPagar[]> {
  const mes = hoy.slice(0, 7), meses = [sumarMeses(mes, -1), mes, sumarMeses(mes, 1)]
  const [{ data: fijos, error }, { data: pagos }] = await Promise.all([
    supabase.from('tcg_fijos').select('*'),
    supabase.from('tcg_gastos').select('fijo_id, mes_fijo').in('mes_fijo', meses).not('fijo_id', 'is', null),
  ])
  if (error) return [] // sin la migración de fijos todavía
  const pagado = new Set((pagos ?? []).map((p) => `${p.fijo_id}|${p.mes_fijo}`))
  const lista: FijoPorPagar[] = []
  for (const f of fijos ?? []) {
    const cada = Number(f.cada_meses ?? 1)
    for (const m of meses) {
      if (!fijoAplica(f, m) || pagado.has(`${f.id}|${m}`)) continue
      const vence = vencimiento(m, f.dia)
      const diasRestantes = diasEntre(hoy, vence)
      if (diasRestantes <= (cada > 1 ? Math.max(dias, DIAS_AVISO_NO_MENSUAL) : dias)) {
        lista.push({ id: f.id, ambito: f.ambito, nombre: f.nombre, monto: Number(f.monto), mes: m, vence, diasRestantes, cada_meses: cada })
      }
    }
  }
  return lista.sort((a, b) => a.diasRestantes - b.diasRestantes)
}

// ── Vehículos: kilometraje, aceite y documentos ────────────────────────────

/** Un gasto de la empresa solo se liga a un camión; uno del hogar, a un carro de la familia */
export async function vehiculoDelAmbito(supabase: Sesion['supabase'], camionId: number | null | undefined, ambito: Ambito) {
  if (!camionId) return null
  const { data } = await supabase.from('tcg_camiones').select('uso').eq('id', camionId).single()
  return data && AMBITO_DE_USO[(data.uso ?? 'empresa') as Uso] === ambito ? camionId : null
}

export interface DatosVehiculo {
  kmActual: number | null
  kmFecha: string | null
  aceite: EstadoAceite
}

/** Kilometraje actual (la lectura más alta, de las capturadas o de los trabajos) y estado del aceite de cada vehículo */
export async function datosVehiculos(supabase: Sesion['supabase'], camiones: Camion[], hoy: string) {
  const ids = camiones.map((c) => c.id)
  if (!ids.length) return new Map<number, DatosVehiculo>()
  const [lecturas, trabajos] = await Promise.all([
    supabase.from('tcg_kilometraje').select('camion_id, km, fecha').in('camion_id', ids),
    supabase.from('tcg_trabajos').select('camion_id, kilometraje, fecha, cambio_aceite').in('camion_id', ids),
  ])
  const datos = new Map<number, DatosVehiculo>()
  for (const c of camiones) {
    const marcas = [
      ...(lecturas.data ?? []).filter((l) => l.camion_id === c.id).map((l) => ({ km: Number(l.km), fecha: l.fecha as string })),
      ...(trabajos.data ?? []).filter((t) => t.camion_id === c.id && t.kilometraje != null).map((t) => ({ km: Number(t.kilometraje), fecha: t.fecha as string })),
      ...(c.aceite_ultimo_km != null ? [{ km: c.aceite_ultimo_km, fecha: c.aceite_ultima_fecha ?? '' }] : []),
    ]
    const mayor = marcas.reduce<{ km: number; fecha: string } | null>((a, m) => (!a || m.km > a.km ? m : a), null)
    const cambios = (trabajos.data ?? []).filter((t) => t.camion_id === c.id && t.cambio_aceite)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    const ultimo = cambios[0] ? { km: cambios[0].kilometraje != null ? Number(cambios[0].kilometraje) : null, fecha: cambios[0].fecha as string } : null
    datos.set(c.id, { kmActual: mayor?.km ?? null, kmFecha: mayor?.fecha || null, aceite: estadoAceite(c, mayor?.km ?? null, ultimo, hoy) })
  }
  return datos
}

export interface PendienteVehiculo {
  camion_id: number
  vehiculo: string
  uso: Uso
  tipo: 'documento' | 'aceite'
  /** Documento: su id; aceite: null */
  documento_id: number | null
  titulo: string
  estado: EstadoVencimiento | EstadoAceite['estado']
  fecha: string | null
  diasRestantes: number | null
  faltanKm: number | null
}

/**
 * Documentos vencidos, que tocan este mes o vencen en 30 días, y cambios de aceite próximos o pasados,
 * de los vehículos en servicio. Para los avisos de Transportes.
 */
export async function pendientesVehiculos(supabase: Sesion['supabase'], hoy: string): Promise<PendienteVehiculo[]> {
  const [{ data: camiones, error }, { data: docs }] = await Promise.all([
    supabase.from('tcg_camiones').select('*').eq('activo', true),
    supabase.from('tcg_documentos').select('id, camion_id, tipo, nombre, vence').not('vence', 'is', null),
  ])
  if (error || !camiones) return [] // sin la migración de vehículos todavía
  const nombre = new Map(camiones.map((c) => [c.id, c.nombre as string]))
  const uso = new Map(camiones.map((c) => [c.id, (c.uso ?? 'empresa') as Uso]))
  const lista: PendienteVehiculo[] = []
  for (const d of docs ?? []) {
    if (!nombre.has(d.camion_id)) continue
    const estado = estadoVencimiento(d.vence, hoy)
    if (estado === 'ok' || estado === 'sin_fecha') continue
    lista.push({
      camion_id: d.camion_id, vehiculo: nombre.get(d.camion_id)!, uso: uso.get(d.camion_id)!, tipo: 'documento', documento_id: d.id,
      titulo: d.nombre || ETIQUETA_DOCUMENTO[d.tipo as TipoDocumento] || 'Documento', estado, fecha: d.vence, diasRestantes: diasEntre(hoy, d.vence), faltanKm: null,
    })
  }
  const datos = await datosVehiculos(supabase, camiones as Camion[], hoy)
  for (const c of camiones) {
    const a = datos.get(c.id)?.aceite
    if (!a || (a.estado !== 'pronto' && a.estado !== 'vencido')) continue
    lista.push({
      camion_id: c.id, vehiculo: c.nombre, uso: uso.get(c.id)!, tipo: 'aceite', documento_id: null, titulo: 'Cambio de aceite',
      estado: a.estado, fecha: a.proximaFecha, diasRestantes: a.faltanDias, faltanKm: a.faltanKm,
    })
  }
  return lista.sort((a, b) => (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999))
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

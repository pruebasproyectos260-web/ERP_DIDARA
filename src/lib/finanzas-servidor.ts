import { NextResponse } from 'next/server'
import type { Sesion } from '@/lib/auth'
import {
  hoyMexico, montoFijoReal, rangoMes, recurrenteVigente, redondear, sumarMeses, TASA_IVA, vencimiento, veFinanzas,
} from '@/lib/finanzas'

type Supabase = Sesion['supabase']

export const esFinanzas = (s: Pick<Sesion, 'nivel' | 'esContador'>) => veFinanzas(s.nivel, s.esContador)

/** 403 si quien llama no es administración ni contabilidad */
export function soloFinanzas(s: Sesion) {
  return esFinanzas(s) ? null : NextResponse.json({ error: 'Solo administración y contabilidad pueden ver esta sección' }, { status: 403 })
}

export const SELECT_MOVIMIENTO = '*, cliente:clientes(id, nombre), cotizacion:cotizaciones(id, folio), reporte:reportes(id, folio)'

/** Las relaciones embebidas de Supabase pueden venir como objeto o como arreglo de uno */
const unir = <T,>(v: unknown) => ((Array.isArray(v) ? v[0] : v) ?? null) as T | null

// ── Cobranza ──────────────────────────────────────────────────────────────

export interface PorCobrar {
  origen: 'cotizacion' | 'reporte'
  id: number
  folio: string
  cliente_id: number | null
  cliente: string
  fecha: string
  estado: string
  /** Importe del documento SIN IVA */
  base: number
  /** IVA que se suma si se factura: el de la cotización, o 16 % */
  tasa_iva: number
  /** ¿Se cobra con factura? Cotización con IVA o facturada; en reportes se decide al cobrar */
  con_factura: boolean
  /** Lo abonado sin IVA */
  cobrado_base: number
  /** Dinero recibido (IVA incluido) */
  cobrado: number
  saldo_base: number
  /** Lo que falta por recibir: con IVA si se factura */
  saldo: number
  /** Total del documento: con IVA si se factura */
  total: number
  dias: number
}

/**
 * Importe sin IVA de un documento y la tasa que se le suma si se factura.
 * Cotización con IVA: su total ya trae el IVA (base = total − IVA). Lo demás: el total es sin IVA.
 */
export function baseDeDocumento(doc: { total: unknown; estado?: unknown; aplica_iva?: unknown; iva_monto?: unknown }, esCotizacion: boolean) {
  const total = Number(doc.total ?? 0)
  if (esCotizacion && doc.aplica_iva) {
    const base = redondear(total - Number(doc.iva_monto ?? 0))
    return { base, tasa: base > 0 ? Number(doc.iva_monto ?? 0) / base : TASA_IVA, conFactura: true }
  }
  return { base: total, tasa: TASA_IVA, conFactura: esCotizacion && doc.estado === 'facturada' }
}

/** Lo cobrado de un documento: dinero recibido y su parte sin IVA */
export function sumarCobrado(pagos: { monto: unknown; iva: unknown }[]) {
  return {
    cobrado: redondear(pagos.reduce((a, p) => a + Number(p.monto), 0)),
    cobradoBase: redondear(pagos.reduce((a, p) => a + Number(p.monto) - Number(p.iva ?? 0), 0)),
  }
}

/**
 * Lo que se debe cobrar:
 * - Cotizaciones aceptadas, aprobadas o facturadas (el cliente ya dijo que sí).
 * - Reportes FIRMADOS por el cliente con importe (firmar = autorizar el trabajo y el monto).
 * Menos lo que ya se registró como pagado en Finanzas. Más recientes primero.
 */
export async function cuentasPorCobrar(supabase: Supabase) {
  const [cots, reps, pagos] = await Promise.all([
    supabase.from('cotizaciones')
      .select('id, folio, fecha, estado, total, iva_monto, aplica_iva, cliente_id, cliente:clientes(nombre)')
      .in('estado', ['aceptada', 'aprobada', 'facturada']).gt('total', 0),
    supabase.from('reportes')
      .select('id, folio, fecha_ingreso, fecha_entrega, firma_fecha, estado, total, cliente_id, cliente:clientes(nombre)')
      .gt('total', 0).not('firma_fecha', 'is', null),
    supabase.from('movimientos').select('cotizacion_id, reporte_id, monto, iva')
      .eq('tipo', 'ingreso').or('cotizacion_id.not.is.null,reporte_id.not.is.null'),
  ])
  const error = cots.error ?? reps.error ?? pagos.error
  if (error) return { data: [] as PorCobrar[], error }

  const pagosDe = (campo: 'cotizacion_id' | 'reporte_id', id: number) => (pagos.data ?? []).filter((p) => p[campo] === id)
  const hoy = Date.now()
  const dias = (f: string) => Math.max(0, Math.floor((hoy - new Date(`${f}T12:00:00`).getTime()) / 86_400_000))

  const armar = (origen: 'cotizacion' | 'reporte', doc: Record<string, unknown> & { total: unknown }, fecha: string): PorCobrar => {
    const { base, tasa, conFactura } = baseDeDocumento(doc, origen === 'cotizacion')
    const { cobrado, cobradoBase } = sumarCobrado(pagosDe(origen === 'cotizacion' ? 'cotizacion_id' : 'reporte_id', doc.id as number))
    const saldoBase = redondear(base - cobradoBase)
    const conIva = (n: number) => (conFactura ? redondear(n * (1 + tasa)) : n)
    return {
      origen, id: doc.id as number, folio: doc.folio as string, cliente_id: doc.cliente_id as number | null,
      cliente: unir<{ nombre: string }>(doc.cliente)?.nombre ?? 'Sin cliente',
      fecha, estado: doc.estado as string,
      base, tasa_iva: tasa, con_factura: conFactura,
      cobrado_base: cobradoBase, cobrado, saldo_base: saldoBase,
      saldo: conIva(saldoBase), total: conIva(base), dias: dias(fecha),
    }
  }

  const items: PorCobrar[] = [
    ...(cots.data ?? []).map((c) => armar('cotizacion', c, c.fecha)),
    ...(reps.data ?? []).map((r) => armar('reporte', r, (r.firma_fecha as string | null)?.slice(0, 10) ?? r.fecha_entrega ?? r.fecha_ingreso)),
  ].filter((i) => i.saldo_base > 0.009).sort((a, b) => b.fecha.localeCompare(a.fecha))

  return { data: items, error: null }
}

// ── Pagos y cobros fijos ───────────────────────────────────────────────────

export interface Recurrente {
  id: number
  tipo: 'gasto' | 'ingreso'
  nombre: string
  categoria: string
  monto: number
  dia: number | null
  desde: string
  hasta: string | null
  cliente_id: number | null
  metodo_pago: string | null
  con_factura: boolean
  notas: string | null
}

/** Todos los fijos, con lo que se pagó/cobró en el mes indicado */
export async function fijosDelMes(supabase: Supabase, mes: string) {
  const [recs, hechos] = await Promise.all([
    supabase.from('fin_recurrentes').select('*, cliente:clientes(id, nombre)').order('dia', { ascending: true, nullsFirst: false }),
    supabase.from('movimientos').select('id, recurrente_id, monto, fecha, metodo_pago')
      .eq('mes_recurrente', mes).not('recurrente_id', 'is', null),
  ])
  const error = recs.error ?? hechos.error
  if (error) return { data: [], error }

  return {
    data: (recs.data ?? []).map((r) => ({
      ...(r as Recurrente),
      cliente: unir<{ id: number; nombre: string }>(r.cliente),
      vigente: recurrenteVigente(r, mes),
      vence: vencimiento(mes, r.dia),
      hecho: (hechos.data ?? []).find((h) => h.recurrente_id === r.id) ?? null,
    })),
    error: null,
  }
}

// ── Resumen del mes ────────────────────────────────────────────────────────

export async function resumenMes(supabase: Supabase, mes: string) {
  const inicio = sumarMeses(mes, -11)
  const { hasta } = rangoMes(mes)
  const [movs, fijos, cobranza, porRevisar] = await Promise.all([
    supabase.from('movimientos').select('tipo, fecha, categoria, monto, con_factura, iva')
      .gte('fecha', `${inicio}-01`).lte('fecha', hasta),
    fijosDelMes(supabase, mes),
    cuentasPorCobrar(supabase),
    supabase.from('movimientos').select('id', { count: 'exact', head: true }).eq('revisado', false),
  ])
  if (movs.error) return { data: null, error: movs.error }

  // Tendencia de 12 meses
  const meses = Array.from({ length: 12 }, (_, i) => sumarMeses(inicio, i))
  const tendencia = new Map(meses.map((m) => [m, { mes: m, ingresos: 0, gastos: 0 }]))
  const delMes = { ingresos: 0, gastos: 0, ivaCobrado: 0, ivaPagado: 0 }
  const porCategoria = new Map<string, number>()
  const anterior = sumarMeses(mes, -1)

  for (const m of movs.data ?? []) {
    const clave = m.fecha.slice(0, 7)
    const t = tendencia.get(clave)
    const monto = Number(m.monto)
    if (t) t[m.tipo === 'ingreso' ? 'ingresos' : 'gastos'] += monto
    if (clave !== mes) continue
    if (m.tipo === 'ingreso') {
      delMes.ingresos += monto
      if (m.con_factura) delMes.ivaCobrado += Number(m.iva ?? 0)
    } else {
      delMes.gastos += monto
      if (m.con_factura) delMes.ivaPagado += Number(m.iva ?? 0)
      porCategoria.set(m.categoria, (porCategoria.get(m.categoria) ?? 0) + monto)
    }
  }

  const fijosMes = (fijos.data ?? []).filter((f) => f.vigente)
  const resumenFijos = (tipo: 'gasto' | 'ingreso') => {
    const lista = fijosMes.filter((f) => f.tipo === tipo)
    const pendientes = lista.filter((f) => !f.hecho)
    return {
      total: lista.length, hechos: lista.length - pendientes.length,
      // Cobros con factura: el cliente paga el monto + IVA
      montoPendiente: redondear(pendientes.reduce((a, f) => a + montoFijoReal(f), 0)),
      vencidos: pendientes.filter((f) => f.vence < hoyMexico()).length,
    }
  }
  const mesAnt = tendencia.get(anterior)

  return {
    data: {
      mes,
      ingresos: redondear(delMes.ingresos),
      gastos: redondear(delMes.gastos),
      balance: redondear(delMes.ingresos - delMes.gastos),
      anterior: mesAnt ? { ingresos: redondear(mesAnt.ingresos), gastos: redondear(mesAnt.gastos) } : null,
      iva: { cobrado: redondear(delMes.ivaCobrado), pagado: redondear(delMes.ivaPagado) },
      porCategoria: [...porCategoria.entries()].map(([categoria, monto]) => ({ categoria, monto: redondear(monto) })).sort((a, b) => b.monto - a.monto),
      tendencia: [...tendencia.values()].map((t) => ({ ...t, ingresos: redondear(t.ingresos), gastos: redondear(t.gastos) })),
      pagosFijos: resumenFijos('gasto'),
      cobrosFijos: resumenFijos('ingreso'),
      porCobrar: {
        total: redondear((cobranza.data ?? []).reduce((a, i) => a + i.saldo, 0)),
        documentos: cobranza.data?.length ?? 0,
      },
      porRevisar: porRevisar.count ?? 0,
    },
    error: null,
  }
}

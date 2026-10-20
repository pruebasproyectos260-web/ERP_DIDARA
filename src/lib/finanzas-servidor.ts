import { NextResponse } from 'next/server'
import type { Sesion } from '@/lib/auth'
import { hoyMexico, rangoMes, recurrenteVigente, redondear, sumarMeses, vencimiento, veFinanzas } from '@/lib/finanzas'

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
  total: number
  iva: number
  con_factura: boolean
  cobrado: number
  saldo: number
  dias: number
}

/**
 * Lo que se debe cobrar:
 * - Cotizaciones aceptadas, aprobadas o facturadas (el cliente ya dijo que sí).
 * - Reportes FIRMADOS por el cliente con importe (firmar = autorizar el trabajo y el monto).
 * Menos lo que ya se registró como pagado en Finanzas.
 */
export async function cuentasPorCobrar(supabase: Supabase) {
  const [cots, reps, pagos] = await Promise.all([
    supabase.from('cotizaciones')
      .select('id, folio, fecha, estado, total, iva_monto, aplica_iva, cliente_id, cliente:clientes(nombre)')
      .in('estado', ['aceptada', 'aprobada', 'facturada']).gt('total', 0),
    supabase.from('reportes')
      .select('id, folio, fecha_ingreso, fecha_entrega, firma_fecha, estado, total, cliente_id, cliente:clientes(nombre)')
      .gt('total', 0).not('firma_fecha', 'is', null),
    supabase.from('movimientos').select('cotizacion_id, reporte_id, monto')
      .eq('tipo', 'ingreso').or('cotizacion_id.not.is.null,reporte_id.not.is.null'),
  ])
  const error = cots.error ?? reps.error ?? pagos.error
  if (error) return { data: [] as PorCobrar[], error }

  const pagadoCot = new Map<number, number>()
  const pagadoRep = new Map<number, number>()
  for (const p of pagos.data ?? []) {
    if (p.cotizacion_id) pagadoCot.set(p.cotizacion_id, (pagadoCot.get(p.cotizacion_id) ?? 0) + Number(p.monto))
    else if (p.reporte_id) pagadoRep.set(p.reporte_id, (pagadoRep.get(p.reporte_id) ?? 0) + Number(p.monto))
  }
  const hoy = Date.now()
  const dias = (f: string) => Math.max(0, Math.floor((hoy - new Date(`${f}T12:00:00`).getTime()) / 86_400_000))

  const items: PorCobrar[] = [
    ...(cots.data ?? []).map((c) => {
      const cobrado = redondear(pagadoCot.get(c.id) ?? 0)
      return {
        origen: 'cotizacion' as const, id: c.id, folio: c.folio, cliente_id: c.cliente_id,
        cliente: unir<{ nombre: string }>(c.cliente)?.nombre ?? 'Sin cliente',
        fecha: c.fecha, estado: c.estado, total: Number(c.total),
        iva: c.aplica_iva ? Number(c.iva_monto ?? 0) : 0, con_factura: !!c.aplica_iva || c.estado === 'facturada',
        cobrado, saldo: redondear(Number(c.total) - cobrado), dias: dias(c.fecha),
      }
    }),
    ...(reps.data ?? []).map((r) => {
      const cobrado = redondear(pagadoRep.get(r.id) ?? 0)
      const fecha = (r.firma_fecha as string | null)?.slice(0, 10) ?? r.fecha_entrega ?? r.fecha_ingreso
      return {
        origen: 'reporte' as const, id: r.id, folio: r.folio, cliente_id: r.cliente_id,
        cliente: unir<{ nombre: string }>(r.cliente)?.nombre ?? 'Sin cliente',
        fecha, estado: r.estado, total: Number(r.total), iva: 0, con_factura: false,
        cobrado, saldo: redondear(Number(r.total) - cobrado), dias: dias(fecha),
      }
    }),
  ].filter((i) => i.saldo > 0.009).sort((a, b) => a.fecha.localeCompare(b.fecha))

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
      montoPendiente: redondear(pendientes.reduce((a, f) => a + Number(f.monto), 0)),
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

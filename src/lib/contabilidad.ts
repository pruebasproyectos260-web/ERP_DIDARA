import type { Sesion } from '@/lib/auth'
import { hoyMexico, nombreMes, rangoMes, redondear, sumarMeses } from '@/lib/finanzas'
import { cuentasPorCobrar, fijosDelMes, type PorCobrar } from '@/lib/finanzas-servidor'

// Datos del reporte para contabilidad (pantalla, Excel y correo mensual).
// "monto" de cada movimiento es el dinero real; subtotal = monto − IVA (ver regla de IVA en lib/finanzas.ts).

type Supabase = Sesion['supabase']

export interface FilaIngreso {
  fecha: string; cliente: string; rfc: string; concepto: string; folio: string; categoria: string
  metodo: string; factura: boolean; subtotal: number; iva: number; total: number; registro: string; comprobantes: string[]
}
export interface FilaGasto {
  fecha: string; proveedor: string; concepto: string; categoria: string; metodo: string; factura: boolean
  subtotal: number; iva: number; total: number; registro: string; reviso: string; revisado: boolean; comprobantes: string[]
}
interface Suma { n: number; subtotal: number; iva: number; total: number }

export interface DatosContables {
  desde: string
  hasta: string
  titulo: string
  ingresos: FilaIngreso[]
  gastos: FilaGasto[]
  resumen: {
    ingresos: { conFactura: Suma; sinFactura: Suma; total: number }
    gastos: { conFactura: Suma; sinFactura: Suma; total: number }
    iva: { cobrado: number; pagado: number; diferencia: number }
    porCategoria: { categoria: string; total: number; conFactura: number }[]
  }
  pendientes: {
    gastosSinComprobante: FilaGasto[]
    ingresosSinIva: FilaIngreso[]
    gastosSinRevisar: FilaGasto[]
    fijosSinMarcar: { mes: string; tipo: 'gasto' | 'ingreso'; nombre: string; monto: number }[]
    porCobrar: PorCobrar[]
  }
}

const unir = <T,>(v: unknown) => ((Array.isArray(v) ? v[0] : v) ?? null) as T | null
const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

/** "Octubre 2026" si el periodo es un mes completo; si no, "1 ene 2026 – 20 oct 2026" */
export function tituloPeriodo(desde: string, hasta: string) {
  const mes = desde.slice(0, 7)
  const r = rangoMes(mes)
  return desde === r.desde && hasta === r.hasta ? nombreMes(mes) : `${fechaLarga(desde)} – ${fechaLarga(hasta)}`
}

const suma = (filas: { subtotal: number; iva: number; total: number }[]): Suma => ({
  n: filas.length,
  subtotal: redondear(filas.reduce((a, f) => a + f.subtotal, 0)),
  iva: redondear(filas.reduce((a, f) => a + f.iva, 0)),
  total: redondear(filas.reduce((a, f) => a + f.total, 0)),
})

export async function datosContables(supabase: Supabase, desde: string, hasta: string): Promise<DatosContables> {
  const { data: movs, error } = await supabase.from('movimientos')
    .select('*, cliente:clientes(nombre, rfc), cotizacion:cotizaciones(folio), reporte:reportes(folio)')
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha').order('created_at')
  if (error) throw error

  const ingresos: FilaIngreso[] = []
  const gastos: FilaGasto[] = []
  for (const m of movs ?? []) {
    const total = Number(m.monto)
    const iva = Number(m.iva ?? 0)
    const base = { fecha: m.fecha as string, factura: !!m.con_factura, subtotal: redondear(total - iva), iva, total, comprobantes: (m.comprobantes ?? []) as string[] }
    if (m.tipo === 'ingreso') {
      const cliente = unir<{ nombre: string; rfc: string | null }>(m.cliente)
      ingresos.push({
        ...base, cliente: cliente?.nombre ?? '', rfc: cliente?.rfc ?? '',
        concepto: m.descripcion ?? m.categoria, categoria: m.categoria,
        folio: unir<{ folio: string }>(m.cotizacion)?.folio ?? unir<{ folio: string }>(m.reporte)?.folio ?? '',
        metodo: m.metodo_pago ?? '', registro: m.registrado_nombre?.trim() ?? '',
      })
    } else {
      gastos.push({
        ...base, proveedor: m.proveedor ?? '', concepto: m.descripcion ?? '', categoria: m.categoria,
        metodo: m.metodo_pago ?? '', registro: m.registrado_nombre?.trim() ?? '',
        reviso: m.revisado_por?.trim() ?? '', revisado: !!m.revisado,
      })
    }
  }

  // Gastos por categoría
  const cats = new Map<string, { total: number; conFactura: number }>()
  for (const g of gastos) {
    const c = cats.get(g.categoria) ?? { total: 0, conFactura: 0 }
    c.total += g.total
    if (g.factura) c.conFactura += g.total
    cats.set(g.categoria, c)
  }

  // Pagos/cobros fijos sin marcar en los meses del periodo (hasta el mes actual)
  const hoy = hoyMexico()
  const meses: string[] = []
  for (let m = desde.slice(0, 7); m <= hasta.slice(0, 7) && m <= hoy.slice(0, 7); m = sumarMeses(m, 1)) meses.push(m)
  const fijos = await Promise.all(meses.slice(-12).map(async (mes) => ({ mes, lista: (await fijosDelMes(supabase, mes)).data })))
  const fijosSinMarcar = fijos.flatMap(({ mes, lista }) => lista
    .filter((f) => f.vigente && !f.hecho)
    .map((f) => ({ mes, tipo: f.tipo, nombre: f.nombre, monto: Number(f.monto) })))

  const ingCon = ingresos.filter((i) => i.factura)
  const gasCon = gastos.filter((g) => g.factura)
  const ivaCobrado = redondear(ingCon.reduce((a, i) => a + i.iva, 0))
  const ivaPagado = redondear(gasCon.reduce((a, g) => a + g.iva, 0))

  return {
    desde, hasta, titulo: tituloPeriodo(desde, hasta),
    ingresos, gastos,
    resumen: {
      ingresos: { conFactura: suma(ingCon), sinFactura: suma(ingresos.filter((i) => !i.factura)), total: suma(ingresos).total },
      gastos: { conFactura: suma(gasCon), sinFactura: suma(gastos.filter((g) => !g.factura)), total: suma(gastos).total },
      iva: { cobrado: ivaCobrado, pagado: ivaPagado, diferencia: redondear(ivaCobrado - ivaPagado) },
      porCategoria: [...cats.entries()].map(([categoria, v]) => ({ categoria, total: redondear(v.total), conFactura: redondear(v.conFactura) }))
        .sort((a, b) => b.total - a.total),
    },
    pendientes: {
      gastosSinComprobante: gasCon.filter((g) => g.comprobantes.length === 0),
      ingresosSinIva: ingCon.filter((i) => !(i.iva > 0)),
      gastosSinRevisar: gastos.filter((g) => !g.revisado),
      fijosSinMarcar,
      porCobrar: (await cuentasPorCobrar(supabase)).data,
    },
  }
}

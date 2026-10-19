'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Users, FileText, Wrench, RefreshCw, Wallet,
  ArrowUpRight, ArrowDownRight, PackageX, ChevronRight,
} from 'lucide-react'
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Filler, Title,
} from 'chart.js'
import { Doughnut, Line, Bar } from 'react-chartjs-2'
import { useTemaOscuro } from '@/lib/tema'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Title)

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
const fmtCorto = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', notation: 'compact', maximumFractionDigits: 1 }).format(n)

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGOS = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const PAGADAS = ['pagada', 'facturada']
const CERRADAS = ['pagada', 'facturada', 'cancelada', 'rechazada']

interface DashData {
  cotizaciones: { id: number; fecha: string; estado: string; total: number; ganancia_total?: number; ganancia_real?: number; pct_didara?: number }[]
  reportes: { id: number; fecha_ingreso: string; total: number }[]
  ingresosManuales: { id: number; fecha: string; monto: number }[]
  gananciasFijas: { id: number; monto: number; fecha_inicio?: string }[]
  gastosFijos: { id: number; monto: number; fecha_inicio?: string }[]
  gastosVariables: { id: number; fecha: string; monto: number }[]
  mesKey: string; mes: number; anio: number; desde: string; hasta: string
}

interface Props {
  nivel: number
  totalClientes: number
  reportesAbiertos: number
  productosBajoStock: { id: number; nombre: string; stock: number; stock_minimo: number; unidad: string }[]
  totalBajoStock: number
  nombre: string
}

function ganCot(c: { total: number; ganancia_real?: number; ganancia_total?: number; pct_didara?: number }) {
  const base = c.ganancia_real ?? c.ganancia_total ?? c.total
  return base * ((c.pct_didara ?? 100) / 100)
}

function isMesKey(fecha: string, mesKey: string): boolean {
  return (fecha ?? '').slice(0, 7) === mesKey
}

const claveMes = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}`

/** Totales de un mes (mismas reglas que antes; se reutiliza para comparar con el mes anterior) */
function resumenMes(data: DashData | null, mk: string) {
  const cots = (data?.cotizaciones ?? []).filter((c) => isMesKey(c.fecha, mk))
  const reps = (data?.reportes ?? []).filter((r) => isMesKey(r.fecha_ingreso, mk))
  const mans = (data?.ingresosManuales ?? []).filter((m) => isMesKey(m.fecha, mk))
  const ganFijas = (data?.gananciasFijas ?? []).filter((g) => !g.fecha_inicio || g.fecha_inicio <= mk)
  const gastFijos = (data?.gastosFijos ?? []).filter((g) => !g.fecha_inicio || g.fecha_inicio <= mk)
  const gastVar = (data?.gastosVariables ?? []).filter((v) => isMesKey(v.fecha, mk))

  const ingresos = cots.filter((c) => PAGADAS.includes(c.estado)).reduce((a, c) => a + ganCot(c), 0)
    + reps.reduce((a, r) => a + (r.total ?? 0), 0)
    + mans.reduce((a, m) => a + m.monto, 0)
  const totalGanFijas = ganFijas.reduce((a, g) => a + g.monto, 0)
  const totalGastosFijos = gastFijos.reduce((a, g) => a + g.monto, 0)
  const totalGastosVar = gastVar.reduce((a, v) => a + v.monto, 0)
  const gastos = totalGastosFijos + totalGastosVar

  return {
    cots, reps, mans, gastVar, ingresos, totalGanFijas, totalGastosFijos, totalGastosVar, gastos,
    neta: ingresos + totalGanFijas - gastos,
  }
}

/** Variación porcentual; null si no hay base para comparar */
function variacion(actual: number, anterior: number | undefined): number | null {
  if (anterior === undefined || anterior === 0) return null
  return ((actual - anterior) / Math.abs(anterior)) * 100
}

export default function DashboardClient({ nivel, totalClientes, reportesAbiertos, productosBajoStock, totalBajoStock, nombre }: Props) {
  const now = new Date()
  const [mes,  setMes]  = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [recarga, setRecarga] = useState(0)
  const oscuro = useTemaOscuro()
  const esAdmin = nivel <= 1

  // La API devuelve el año completo: solo se vuelve a pedir al cambiar de año o actualizar
  useEffect(() => {
    let cancelado = false
    fetch(`/api/dashboard?mes=${mes}&anio=${anio}`)
      .then((r) => r.json())
      .then((json) => { if (!cancelado) setData(json.data) })
      .catch(() => {})
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
    // mes no va en las dependencias a propósito: cambiarlo no requiere otra consulta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, recarga])

  function cambiarAnio(a: number) { setLoading(true); setAnio(a) }
  function actualizar() { setLoading(true); setRecarga((n) => n + 1) }

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const mesKey = claveMes(anio, mes)
  const actual = resumenMes(data, mesKey)
  const previo = mes > 1 ? resumenMes(data, claveMes(anio, mes - 1)) : undefined

  const cotsPend = actual.cots.filter((c) => !CERRADAS.includes(c.estado)).length
  const cotsPag  = actual.cots.filter((c) => PAGADAS.includes(c.estado)).length
  const cotsCanc = actual.cots.filter((c) => ['cancelada', 'rechazada'].includes(c.estado)).length

  // Ingresos vs gastos por semana
  const semanas = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5']
  const ingresosSem = [0, 0, 0, 0, 0]
  const gastosSem   = [0, 0, 0, 0, 0]
  const ingresoFijoPorSem = actual.totalGanFijas / 4
  const gastoFijoPorSem   = actual.totalGastosFijos / 4
  semanas.forEach((_, i) => { ingresosSem[i] += ingresoFijoPorSem; gastosSem[i] += gastoFijoPorSem })
  const getDiaSem = (fecha: string) => Math.min(Math.ceil(parseInt(fecha.slice(8, 10)) / 7) - 1, 4)
  actual.cots.filter((c) => PAGADAS.includes(c.estado)).forEach((c) => { ingresosSem[getDiaSem(c.fecha)] += ganCot(c) })
  actual.reps.forEach((r) => { ingresosSem[getDiaSem(r.fecha_ingreso)] += r.total ?? 0 })
  actual.mans.forEach((m) => { ingresosSem[getDiaSem(m.fecha)] += m.monto })
  actual.gastVar.forEach((v) => { gastosSem[getDiaSem(v.fecha)] += v.monto })

  // Ganancia neta anual
  const ganAnio  = Array(12).fill(0)
  const gastAnio = Array(12).fill(0)
  for (let mi = 0; mi < 12; mi++) {
    const mk = claveMes(anio, mi + 1)
    ganAnio[mi]  += (data?.gananciasFijas ?? []).filter((g) => !g.fecha_inicio || g.fecha_inicio <= mk).reduce((a, g) => a + g.monto, 0)
    gastAnio[mi] += (data?.gastosFijos ?? []).filter((g) => !g.fecha_inicio || g.fecha_inicio <= mk).reduce((a, g) => a + g.monto, 0)
  }
  ;(data?.cotizaciones ?? []).filter((c) => PAGADAS.includes(c.estado)).forEach((c) => {
    const mi = parseInt(c.fecha.slice(5, 7)) - 1
    if (mi >= 0 && mi < 12) ganAnio[mi] += ganCot(c)
  })
  ;(data?.reportes ?? []).forEach((r) => {
    const mi = parseInt(r.fecha_ingreso.slice(5, 7)) - 1
    if (mi >= 0 && mi < 12) ganAnio[mi] += r.total ?? 0
  })
  ;(data?.ingresosManuales ?? []).forEach((m) => {
    const mi = parseInt(m.fecha.slice(5, 7)) - 1
    if (mi >= 0 && mi < 12) ganAnio[mi] += m.monto
  })
  ;(data?.gastosVariables ?? []).forEach((v) => {
    const mi = parseInt(v.fecha.slice(5, 7)) - 1
    if (mi >= 0 && mi < 12) gastAnio[mi] += v.monto
  })
  const netaAnio = ganAnio.map((g, i) => g - gastAnio[i])

  // ── Estilo de gráficas según el tema ────────────────────────────────────
  const colorTexto = oscuro ? '#94a3a1' : '#6b7280'
  const colorRejilla = oscuro ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.06)'
  const VERDE = '#16a34a', ROJO = '#dc2626', MARCA = '#187d78', AMBAR = '#eab308'
  const ejes = {
    x: { grid: { display: false }, ticks: { color: colorTexto, font: { size: 11 } }, border: { display: false } },
    y: {
      grid: { color: colorRejilla }, border: { display: false },
      ticks: { color: colorTexto, font: { size: 11 }, callback: (v: string | number) => fmtCorto(Number(v)) },
    },
  }
  const tooltip = {
    backgroundColor: oscuro ? '#1a2828' : '#0b2928', padding: 10, cornerRadius: 8,
    callbacks: { label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? 0)}` },
  }

  const nombreCorto = nombre.split(' ')[0] || 'bienvenido'
  const hora = now.getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const selectCls = 'rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-brand-500/30'

  return (
    <div className="space-y-6">
      {/* Saludo + periodo */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{saludo}, {nombreCorto}</h2>
          <p className="mt-1 text-sm text-gray-500 first-letter:uppercase">
            {now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={selectCls} aria-label="Mes">
            {MESES_LARGOS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={anio} onChange={(e) => cambiarAnio(Number(e.target.value))} className={selectCls} aria-label="Año">
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={actualizar} disabled={loading} title="Actualizar"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text)] disabled:opacity-60">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Indicadores */}
      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${esAdmin ? 'md:grid-cols-3 xl:grid-cols-6' : 'md:grid-cols-3'}`}>
        {esAdmin && <>
          <Indicador etiqueta={`Ingresos ${MESES_CORTOS[mes - 1]}`} valor={fmt(actual.ingresos)} cargando={loading}
            detalle={`+${fmt(actual.totalGanFijas)} recurrentes`} icono={<TrendingUp size={17} />} tono="verde"
            cambio={variacion(actual.ingresos, previo?.ingresos)} />
          <Indicador etiqueta={`Gastos ${MESES_CORTOS[mes - 1]}`} valor={fmt(actual.gastos)} cargando={loading}
            detalle={`Fijos: ${fmt(actual.totalGastosFijos)}`} icono={<TrendingDown size={17} />} tono="rojo"
            cambio={variacion(actual.gastos, previo?.gastos)} cambioInvertido />
          <Indicador etiqueta="Ganancia neta" valor={fmt(actual.neta)} cargando={loading} destacado
            detalle={actual.neta >= 0 ? 'Resultado positivo' : 'Resultado negativo'} icono={<Wallet size={17} />}
            tono={actual.neta >= 0 ? 'marca' : 'rojo'} cambio={variacion(actual.neta, previo?.neta)} />
        </>}
        <Indicador etiqueta={`Cotizaciones ${MESES_CORTOS[mes - 1]}`} valor={String(actual.cots.length)} cargando={loading}
          detalle={`${cotsPag} pagadas o facturadas`} icono={<FileText size={17} />} tono="marca"
          cambio={variacion(actual.cots.length, previo?.cots.length)} href="/cotizaciones" />
        <Indicador etiqueta={`Reportes ${MESES_CORTOS[mes - 1]}`} valor={String(actual.reps.length)} cargando={loading}
          detalle={`${reportesAbiertos} en curso`} icono={<Wrench size={17} />} tono="indigo"
          cambio={variacion(actual.reps.length, previo?.reps.length)} href="/reportes" />
        <Indicador etiqueta="Clientes activos" valor={String(totalClientes)} detalle="En cartera"
          icono={<Users size={17} />} tono="gris" href="/clientes" />
      </div>

      {/* Gráficas — solo admin */}
      {esAdmin && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Tarjeta titulo="Ingresos vs gastos" subtitulo={`Por semana · ${MESES_LARGOS[mes]} ${anio}`} className="xl:col-span-2">
            <div className="h-64 sm:h-72">
              <Line
                data={{
                  labels: semanas,
                  datasets: [
                    { label: 'Ingresos', data: ingresosSem, borderColor: VERDE, backgroundColor: 'rgba(22,163,74,0.10)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: VERDE },
                    { label: 'Gastos', data: gastosSem, borderColor: ROJO, backgroundColor: 'rgba(220,38,38,0.08)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: ROJO },
                  ],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                  plugins: { legend: { position: 'top', align: 'end', labels: { color: colorTexto, boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 12 } } }, tooltip },
                  scales: ejes,
                }}
              />
            </div>
          </Tarjeta>

          <Tarjeta titulo="Estado de cotizaciones" subtitulo={`${MESES_LARGOS[mes]} ${anio}`}>
            {actual.cots.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">Sin cotizaciones este mes.</p>
            ) : (
              <div className="flex flex-col items-center gap-5">
                <div className="relative h-44 w-44">
                  <Doughnut
                    data={{
                      labels: ['En proceso', 'Pagadas / facturadas', 'Canceladas / rechazadas'],
                      datasets: [{ data: [cotsPend, cotsPag, cotsCanc], backgroundColor: [AMBAR, VERDE, ROJO], borderWidth: 0, hoverOffset: 4 }],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: {} } } }}
                  />
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-semibold text-gray-900">{actual.cots.length}</span>
                    <span className="text-xs text-gray-500">cotizaciones</span>
                  </div>
                </div>
                <ul className="w-full space-y-2 text-sm">
                  {[['En proceso', cotsPend, AMBAR], ['Pagadas / facturadas', cotsPag, VERDE], ['Canceladas / rechazadas', cotsCanc, ROJO]].map(([etq, n, color]) => (
                    <li key={etq as string} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-gray-600">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color as string }} />{etq}
                      </span>
                      <span className="font-semibold text-gray-900">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Ganancia neta mensual" subtitulo={`Año ${anio}`} className="xl:col-span-3">
            <div className="h-64">
              <Bar
                data={{
                  labels: MESES_CORTOS,
                  datasets: [{
                    label: 'Ganancia neta',
                    data: netaAnio,
                    backgroundColor: netaAnio.map((v, i) => (i === mes - 1 ? (v >= 0 ? MARCA : ROJO) : v >= 0 ? 'rgba(24,125,120,0.35)' : 'rgba(220,38,38,0.35)')),
                    borderRadius: 6,
                    maxBarThickness: 42,
                  }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip }, scales: ejes }}
              />
            </div>
          </Tarjeta>
        </div>
      )}

      {/* Productos bajo stock */}
      {productosBajoStock.length > 0 && (
        <Tarjeta
          titulo="Productos con bajo stock"
          subtitulo={`${totalBajoStock} producto${totalBajoStock === 1 ? '' : 's'} en o por debajo de su mínimo`}
          icono={<PackageX size={17} className="text-orange-600" />}
          accion={<Link href="/inventario?bajoStock=1" className="flex items-center gap-0.5 text-sm font-medium text-brand-700 hover:underline">Ver todos <ChevronRight size={15} /></Link>}
        >
          <ul className="divide-y divide-gray-100">
            {productosBajoStock.map((p) => {
              const agotado = Number(p.stock) <= 0
              const pct = Math.max(0, Math.min(100, (Number(p.stock) / Number(p.stock_minimo)) * 100))
              return (
                <li key={p.id} className="flex items-center gap-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{p.nombre}</span>
                  <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 sm:block">
                    <div className={`h-full rounded-full ${agotado ? 'bg-red-500' : 'bg-orange-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`w-28 shrink-0 text-right text-sm font-medium ${agotado ? 'text-red-600' : 'text-orange-600'}`}>
                    {agotado ? 'Agotado' : `${p.stock} ${p.unidad}`}
                    <span className="ml-1 text-xs font-normal text-gray-400">/ {p.stock_minimo}</span>
                  </span>
                </li>
              )
            })}
          </ul>
          {totalBajoStock > productosBajoStock.length && (
            <p className="mt-2 text-xs text-gray-400">y {totalBajoStock - productosBajoStock.length} más…</p>
          )}
        </Tarjeta>
      )}
    </div>
  )
}

// ── Componentes ────────────────────────────────────────────────────────────

function Tarjeta({ titulo, subtitulo, icono, accion, className = '', children }: {
  titulo: string; subtitulo?: string; icono?: React.ReactNode; accion?: React.ReactNode; className?: string; children: React.ReactNode
}) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm shadow-black/[0.02] ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icono}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
            {subtitulo && <p className="mt-0.5 text-xs text-gray-500">{subtitulo}</p>}
          </div>
        </div>
        {accion}
      </div>
      {children}
    </section>
  )
}

const TONOS: Record<string, string> = {
  verde: 'bg-green-50 text-green-600',
  rojo: 'bg-red-50 text-red-600',
  marca: 'bg-brand-50 text-brand-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  gris: 'bg-gray-100 text-gray-600',
}

function Indicador({ etiqueta, valor, detalle, icono, tono, cambio, cambioInvertido, destacado, cargando, href }: {
  etiqueta: string; valor: string; detalle?: string; icono: React.ReactNode; tono: string
  cambio?: number | null; cambioInvertido?: boolean; destacado?: boolean; cargando?: boolean; href?: string
}) {
  const sube = (cambio ?? 0) >= 0
  const bueno = cambioInvertido ? !sube : sube
  const sinCambio = cambio !== undefined && cambio !== null && Math.abs(cambio) < 0.5
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONOS[tono] ?? TONOS.gris}`}>{icono}</span>
        {cambio !== undefined && cambio !== null && !cargando && (
          <span title="Contra el mes anterior"
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
              sinCambio ? 'bg-gray-100 text-gray-500' : bueno ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {sinCambio ? null : sube ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(cambio) >= 1000 ? '+999' : Math.abs(cambio).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-[13px] text-gray-500">{etiqueta}</p>
      {cargando
        ? <div className="mt-1.5 h-6 w-24 rounded-md bg-gray-100 animate-brillo" />
        : <p className={`mt-0.5 truncate font-semibold tracking-tight text-gray-900 ${valor.length > 12 ? 'text-lg' : 'text-2xl'}`}>{valor}</p>}
      {detalle && <p className="mt-1 truncate text-xs text-gray-400">{detalle}</p>}
    </>
  )
  const cls = `block rounded-2xl border bg-white p-4 shadow-sm shadow-black/[0.02] transition-colors ${
    destacado ? 'border-brand-200 ring-1 ring-brand-100' : 'border-gray-200'
  } ${href ? 'hover:border-brand-300' : ''}`
  return href ? <Link href={href} className={cls}>{contenido}</Link> : <div className={cls}>{contenido}</div>
}

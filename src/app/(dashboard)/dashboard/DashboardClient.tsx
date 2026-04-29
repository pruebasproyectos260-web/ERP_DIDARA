'use client'

import { useState, useEffect, useRef } from 'react'
import { TrendingUp, TrendingDown, Users, FileText, Wrench, RefreshCw } from 'lucide-react'
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Filler, Title,
} from 'chart.js'
import { Doughnut, Line, Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Title)

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGOS = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

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
  nombre: string
}

function ganCot(c: { total: number; ganancia_real?: number; ganancia_total?: number; pct_didara?: number }) {
  const base = c.ganancia_real ?? c.ganancia_total ?? c.total
  return base * ((c.pct_didara ?? 100) / 100)
}

function isMesKey(fecha: string, mesKey: string): boolean {
  return (fecha ?? '').slice(0, 7) === mesKey
}

export default function DashboardClient({ nivel, totalClientes, reportesAbiertos, productosBajoStock, nombre }: Props) {
  const now = new Date()
  const [mes,  setMes]  = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(false)
  const loaded = useRef(false)

  async function cargar(m: number, a: number) {
    setLoading(true)
    const res = await fetch(`/api/dashboard?mes=${m}&anio=${a}`)
    const json = await res.json()
    setData(json.data)
    setLoading(false)
  }

  useEffect(() => {
    if (!loaded.current) { loaded.current = true; cargar(mes, anio) }
  }, [])

  function cambiarMes(m: number) { setMes(m); cargar(m, anio) }
  function cambiarAnio(a: number) { setAnio(a); cargar(mes, a) }

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const mesKey = data?.mesKey ?? `${anio}-${String(mes).padStart(2, '0')}`

  const cotsMes   = (data?.cotizaciones ?? []).filter((c) => isMesKey(c.fecha, mesKey))
  const repsMes   = (data?.reportes ?? []).filter((r) => isMesKey(r.fecha_ingreso, mesKey))
  const mansMes   = (data?.ingresosManuales ?? []).filter((m) => isMesKey(m.fecha, mesKey))

  const gananciasFijasActivas = (data?.gananciasFijas ?? []).filter((g) => !g.fecha_inicio || g.fecha_inicio <= mesKey)
  const gastosFijosActivos    = (data?.gastosFijos ?? []).filter((g) => !g.fecha_inicio || g.fecha_inicio <= mesKey)
  const gastosVarMes          = (data?.gastosVariables ?? []).filter((v) => isMesKey(v.fecha, mesKey))

  const totalIngresosMes  = cotsMes.filter((c) => ['pagada', 'facturada'].includes(c.estado)).reduce((a, c) => a + ganCot(c), 0)
    + repsMes.reduce((a, r) => a + (r.total ?? 0), 0)
    + mansMes.reduce((a, m) => a + m.monto, 0)
  const totalGanFijasMes  = gananciasFijasActivas.reduce((a, g) => a + g.monto, 0)
  const totalGastosFijosMes = gastosFijosActivos.reduce((a, g) => a + g.monto, 0)
  const totalGastosVarMes = gastosVarMes.reduce((a, v) => a + v.monto, 0)
  const totalGastosMes    = totalGastosFijosMes + totalGastosVarMes
  const ganNeta           = totalIngresosMes + totalGanFijasMes - totalGastosMes

  // ── Datos gráfica 1: estados de cotizaciones ─────────────────────────────
  const cotsPend = cotsMes.filter((c) => !['pagada', 'facturada', 'cancelada', 'rechazada'].includes(c.estado)).length
  const cotsPag  = cotsMes.filter((c) => ['pagada', 'facturada'].includes(c.estado)).length
  const cotsCanc = cotsMes.filter((c) => ['cancelada', 'rechazada'].includes(c.estado)).length

  // ── Datos gráfica 2: ingresos vs gastos por semana ───────────────────────
  const semanas = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5']
  const ingresosSem  = [0, 0, 0, 0, 0]
  const gastosSem    = [0, 0, 0, 0, 0]

  const ingresoFijoPorSem = totalGanFijasMes / 4
  const gastoFijoPorSem   = totalGastosFijosMes / 4
  semanas.forEach((_, i) => { ingresosSem[i] += ingresoFijoPorSem; gastosSem[i] += gastoFijoPorSem })

  const getDiaSem = (fecha: string) => {
    const d = parseInt(fecha.slice(8, 10))
    return Math.min(Math.ceil(d / 7) - 1, 4)
  }
  cotsMes.filter((c) => ['pagada', 'facturada'].includes(c.estado)).forEach((c) => { ingresosSem[getDiaSem(c.fecha)] += ganCot(c) })
  repsMes.forEach((r) => { ingresosSem[getDiaSem(r.fecha_ingreso)] += r.total ?? 0 })
  mansMes.forEach((m) => { ingresosSem[getDiaSem(m.fecha)] += m.monto })
  gastosVarMes.forEach((v) => { gastosSem[getDiaSem(v.fecha)] += v.monto })

  // ── Datos gráfica 3: ganancia neta anual ─────────────────────────────────
  const ganAnio  = Array(12).fill(0)
  const gastAnio = Array(12).fill(0)
  for (let mi = 0; mi < 12; mi++) {
    const mk = `${anio}-${String(mi + 1).padStart(2, '0')}`
    ganAnio[mi]  += (data?.gananciasFijas ?? []).filter((g) => !g.fecha_inicio || g.fecha_inicio <= mk).reduce((a, g) => a + g.monto, 0)
    gastAnio[mi] += (data?.gastosFijos ?? []).filter((g) => !g.fecha_inicio || g.fecha_inicio <= mk).reduce((a, g) => a + g.monto, 0)
  }
  ;(data?.cotizaciones ?? []).filter((c) => ['pagada', 'facturada'].includes(c.estado)).forEach((c) => {
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

  const chartOpts = {
    responsive: true,
    plugins: { legend: { labels: { font: { size: 11 } } } },
  }

  return (
    <div className="space-y-6">
      {/* Saludo */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hola, {nombre.split(' ')[0] || 'bienvenido'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Selector mes/año + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={mes} onChange={(e) => cambiarMes(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white">
          {MESES_LARGOS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={anio} onChange={(e) => cambiarAnio(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white">
          {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={() => cargar(mes, anio)} disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {/* Tarjetas */}
      {nivel <= 1 ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label={`Cotizaciones ${MESES_CORTOS[mes - 1]}`} value={cotsMes.length.toString()} sub={`${cotsPag} pagadas/facturadas`} color="blue" icon={<FileText size={18} />} />
          <StatCard label={`Reportes ${MESES_CORTOS[mes - 1]}`} value={repsMes.length.toString()} sub={`${reportesAbiertos} en curso`} color="indigo" icon={<Wrench size={18} />} />
          <StatCard label={`Ingresos ${MESES_CORTOS[mes - 1]}`} value={fmt(totalIngresosMes)} sub={`+${fmt(totalGanFijasMes)} recurrentes`} color="green" icon={<TrendingUp size={18} />} isCurrency />
          <StatCard label={`Gastos ${MESES_CORTOS[mes - 1]}`} value={fmt(totalGastosMes)} sub={`Fijos: ${fmt(totalGastosFijosMes)}`} color="red" icon={<TrendingDown size={18} />} isCurrency />
          <StatCard label="Ganancia neta" value={fmt(ganNeta)} sub="" color={ganNeta >= 0 ? 'emerald' : 'red'} icon={<TrendingUp size={18} />} isCurrency />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={`Cotizaciones ${MESES_CORTOS[mes - 1]}`} value={cotsMes.length.toString()} sub={`${cotsPag} pagadas/facturadas`} color="blue" icon={<FileText size={18} />} />
          <StatCard label={`Reportes ${MESES_CORTOS[mes - 1]}`} value={repsMes.length.toString()} sub={`${reportesAbiertos} en curso`} color="indigo" icon={<Wrench size={18} />} />
        </div>
      )}

      {/* Tarjeta clientes */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <StatCard label="Clientes activos" value={totalClientes.toString()} sub="" color="gray" icon={<Users size={18} />} />
      </div>
      <div className="hidden lg:block">
        <StatCard label="Clientes activos" value={totalClientes.toString()} sub="" color="gray" icon={<Users size={18} />} />
      </div>

      {/* Gráficas — solo admin */}
      {nivel <= 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Doughnut: estados cotizaciones */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Estados de Cotizaciones — {MESES_LARGOS[mes]} {anio}</h3>
            {cotsMes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Sin cotizaciones este mes.</p>
            ) : (
              <Doughnut
                data={{
                  labels: ['Pendientes/Enviadas', 'Pagadas/Facturadas', 'Canceladas/Rechazadas'],
                  datasets: [{ data: [cotsPend, cotsPag, cotsCanc], backgroundColor: ['#EAB308', '#16A34A', '#DC2626'], borderWidth: 1 }],
                }}
                options={{ ...chartOpts, plugins: { ...chartOpts.plugins, legend: { position: 'bottom', labels: { font: { size: 11 } } } } }}
              />
            )}
          </div>

          {/* Line: ingresos vs gastos semanales */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Ingresos vs Gastos — {MESES_LARGOS[mes]} {anio}</h3>
            <Line
              data={{
                labels: semanas,
                datasets: [
                  { label: 'Ingresos', data: ingresosSem, borderColor: '#16A34A', backgroundColor: 'rgba(22,163,74,0.1)', fill: true, tension: 0.3 },
                  { label: 'Gastos',   data: gastosSem,   borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,0.1)',  fill: true, tension: 0.3 },
                ],
              }}
              options={{ ...chartOpts, scales: { y: { ticks: { callback: (v) => `$${Number(v).toLocaleString()}` } } } }}
            />
          </div>

          {/* Bar: ganancia neta anual */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Ganancia Neta Mensual — {anio}</h3>
            <Bar
              data={{
                labels: MESES_CORTOS.map((m) => `${m} ${anio}`),
                datasets: [{
                  label: 'Ganancia neta',
                  data: netaAnio,
                  backgroundColor: netaAnio.map((v) => v >= 0 ? 'rgba(22,163,74,0.7)' : 'rgba(220,38,38,0.7)'),
                  borderColor: netaAnio.map((v) => v >= 0 ? '#16A34A' : '#DC2626'),
                  borderWidth: 1,
                }],
              }}
              options={{ ...chartOpts, scales: { y: { ticks: { callback: (v) => `$${Number(v).toLocaleString()}` } } } }}
            />
          </div>
        </div>
      )}

      {/* Productos bajo stock */}
      {productosBajoStock.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <h2 className="font-semibold text-gray-900 text-sm">Productos con bajo stock</h2>
          </div>
          <div className="space-y-2">
            {productosBajoStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.nombre}</span>
                <span className="text-orange-600 font-medium">{p.stock} {p.unidad} (mín. {p.stock_minimo})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color, icon, isCurrency }: {
  label: string; value: string; sub: string; color: string; icon: React.ReactNode; isCurrency?: boolean
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600', red: 'bg-red-50 text-red-600',
    emerald: 'bg-emerald-50 text-emerald-600', gray: 'bg-gray-100 text-gray-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`w-9 h-9 rounded-lg ${colorMap[color] ?? colorMap.gray} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className={`font-bold text-gray-900 ${isCurrency ? 'text-lg' : 'text-2xl'}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { ArrowDownRight, ArrowUpRight, CalendarClock, ChevronRight, HandCoins, Loader2, ShieldCheck } from 'lucide-react'
import { colorCategoria, formatoMoneda, nombreMes } from '@/lib/finanzas'
import { useTemaOscuro } from '@/lib/tema'
import SelectorMes from './SelectorMes'
import { BurbujaCategoria } from './categorias'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

interface Datos {
  mes: string
  ingresos: number
  gastos: number
  balance: number
  anterior: { ingresos: number; gastos: number } | null
  iva: { cobrado: number; pagado: number }
  porCategoria: { categoria: string; monto: number }[]
  tendencia: { mes: string; ingresos: number; gastos: number }[]
  pagosFijos: { total: number; hechos: number; montoPendiente: number; vencidos: number }
  cobrosFijos: { total: number; hechos: number; montoPendiente: number; vencidos: number }
  porCobrar: { total: number; documentos: number }
  porRevisar: number
}

export type Vista = 'resumen' | 'movimientos' | 'fijos' | 'cobranza'

const corto = (n: number) => (Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`)

function variacion(actual: number, previo: number | undefined) {
  if (!previo) return null
  return ((actual - previo) / previo) * 100
}

export default function Resumen({ mes, onMes, onIr }: {
  mes: string
  onMes: (mes: string) => void
  onIr: (vista: Vista, opciones?: { porRevisar?: boolean }) => void
}) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const oscuro = useTemaOscuro()

  useEffect(() => {
    let cancelado = false
    fetch(`/api/finanzas/resumen?mes=${mes}`)
      .then(async (r) => {
        const j = await r.json()
        if (cancelado) return
        if (!r.ok) setError(j.error ?? 'No se pudo cargar el resumen')
        else { setError(''); setDatos(j.data) }
      })
      .catch(() => { if (!cancelado) setError('Error de red') })
    return () => { cancelado = true }
  }, [mes])

  const texto = oscuro ? '#94a3a1' : '#6b7280'
  const rejilla = oscuro ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.06)'

  return (
    <div className="space-y-4">
      <SelectorMes mes={mes} onCambio={(m) => { setDatos(null); onMes(m) }} />

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        : !datos ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>
        : (
          <>
            {/* Pendientes que requieren atención */}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {datos.porRevisar > 0 && (
                <Alerta tono="ambar" icono={<ShieldCheck size={18} />} onClick={() => onIr('movimientos', { porRevisar: true })}
                  titulo={`${datos.porRevisar} gasto${datos.porRevisar === 1 ? '' : 's'} por revisar`} detalle="Registrados por el equipo" />
              )}
              {datos.pagosFijos.total > datos.pagosFijos.hechos && (
                <Alerta tono={datos.pagosFijos.vencidos ? 'rojo' : 'neutro'} icono={<CalendarClock size={18} />} onClick={() => onIr('fijos')}
                  titulo={`Faltan ${datos.pagosFijos.total - datos.pagosFijos.hechos} pagos fijos`}
                  detalle={`${formatoMoneda(datos.pagosFijos.montoPendiente)}${datos.pagosFijos.vencidos ? ` · ${datos.pagosFijos.vencidos} vencido${datos.pagosFijos.vencidos === 1 ? '' : 's'}` : ''}`} />
              )}
              {datos.cobrosFijos.total > datos.cobrosFijos.hechos && (
                <Alerta tono={datos.cobrosFijos.vencidos ? 'rojo' : 'neutro'} icono={<CalendarClock size={18} />} onClick={() => onIr('fijos')}
                  titulo={`Faltan ${datos.cobrosFijos.total - datos.cobrosFijos.hechos} cobros de pólizas`}
                  detalle={formatoMoneda(datos.cobrosFijos.montoPendiente)} />
              )}
              {datos.porCobrar.total > 0 && (
                <Alerta tono="marca" icono={<HandCoins size={18} />} onClick={() => onIr('cobranza')}
                  titulo={`Te deben ${formatoMoneda(datos.porCobrar.total)}`}
                  detalle={`${datos.porCobrar.documentos} cotizaciones y reportes`} />
              )}
            </div>

            {/* Totales */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Kpi titulo="Entró" valor={datos.ingresos} cls="text-green-600" cambio={variacion(datos.ingresos, datos.anterior?.ingresos)} subeEsBueno />
              <Kpi titulo="Salió" valor={datos.gastos} cls="text-gray-900" cambio={variacion(datos.gastos, datos.anterior?.gastos)} subeEsBueno={false} />
              <Kpi titulo="Quedó" valor={datos.balance} cls={datos.balance >= 0 ? 'text-brand-700' : 'text-red-600'} />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              {/* Gastos por categoría */}
              <section className="rounded-2xl border border-gray-200 bg-white p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-gray-900">¿En qué se fue el dinero?</h3>
                {datos.porCategoria.length === 0 ? (
                  <p className="py-12 text-center text-sm text-gray-400">Sin gastos en {nombreMes(mes)}</p>
                ) : (
                  <>
                    <div className="relative mx-auto my-3 h-44 w-44">
                      <Doughnut
                        data={{
                          labels: datos.porCategoria.map((c) => c.categoria),
                          datasets: [{ data: datos.porCategoria.map((c) => c.monto), backgroundColor: datos.porCategoria.map((c) => colorCategoria(c.categoria)), borderWidth: 0 }],
                        }}
                        options={{ cutout: '72%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${formatoMoneda(Number(c.raw))}` } } } }}
                      />
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[11px] text-gray-400">Gastos</span>
                        <span className="text-lg font-bold tabular-nums text-gray-900">{corto(datos.gastos)}</span>
                      </div>
                    </div>
                    <ul className="space-y-2.5">
                      {datos.porCategoria.map((c) => {
                        const pct = datos.gastos ? (c.monto / datos.gastos) * 100 : 0
                        return (
                          <li key={c.categoria} className="flex items-center gap-3">
                            <BurbujaCategoria categoria={c.categoria} tamano={32} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2 text-sm">
                                <span className="truncate text-gray-700">{c.categoria}</span>
                                <span className="font-semibold tabular-nums text-gray-900">{formatoMoneda(c.monto)}</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colorCategoria(c.categoria) }} />
                              </div>
                            </div>
                            <span className="w-9 text-right text-xs text-gray-400">{Math.round(pct)}%</span>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </section>

              <div className="space-y-4 lg:col-span-3">
                {/* Tendencia */}
                <section className="rounded-2xl border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-900">Últimos 12 meses</h3>
                  <div className="mt-3 h-56">
                    <Bar
                      data={{
                        labels: datos.tendencia.map((t) => nombreMes(t.mes, true)),
                        datasets: [
                          { label: 'Entró', data: datos.tendencia.map((t) => t.ingresos), backgroundColor: '#16a34a', borderRadius: 4, maxBarThickness: 14 },
                          { label: 'Salió', data: datos.tendencia.map((t) => t.gastos), backgroundColor: oscuro ? '#64748b' : '#cbd5e1', borderRadius: 4, maxBarThickness: 14 },
                        ],
                      }}
                      options={{
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom', labels: { color: texto, boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3 } },
                          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${formatoMoneda(Number(c.raw))}` } },
                        },
                        scales: {
                          x: { grid: { display: false }, ticks: { color: texto, font: { size: 11 } }, border: { display: false } },
                          y: { grid: { color: rejilla }, border: { display: false }, ticks: { color: texto, font: { size: 11 }, callback: (v) => corto(Number(v)) } },
                        },
                      }}
                    />
                  </div>
                </section>

                {/* IVA */}
                <section className="rounded-2xl border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-900">IVA del mes <span className="font-normal text-gray-400">(estimado)</span></h3>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-[11px] text-gray-500">Cobrado en facturas</p><p className="font-semibold tabular-nums text-gray-900">{formatoMoneda(datos.iva.cobrado)}</p></div>
                    <div><p className="text-[11px] text-gray-500">Pagado en facturas</p><p className="font-semibold tabular-nums text-gray-900">{formatoMoneda(datos.iva.pagado)}</p></div>
                    <div>
                      <p className="text-[11px] text-gray-500">{datos.iva.cobrado - datos.iva.pagado >= 0 ? 'Por pagar' : 'A favor'}</p>
                      <p className={`font-bold tabular-nums ${datos.iva.cobrado - datos.iva.pagado >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatoMoneda(Math.abs(datos.iva.cobrado - datos.iva.pagado))}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">Solo cuenta lo marcado “con factura”. El cálculo oficial lo hace contabilidad.</p>
                </section>
              </div>
            </div>
          </>
        )}
    </div>
  )
}

function Kpi({ titulo, valor, cls, cambio, subeEsBueno }: { titulo: string; valor: number; cls: string; cambio?: number | null; subeEsBueno?: boolean }) {
  const bueno = cambio == null ? null : (cambio >= 0) === subeEsBueno
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{titulo}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${cls}`}>{formatoMoneda(valor)}</p>
      {cambio != null && Math.abs(cambio) >= 0.5 && (
        <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${bueno ? 'text-green-600' : 'text-red-600'}`}>
          {cambio >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(cambio).toFixed(0)}% vs. mes anterior
        </p>
      )}
    </div>
  )
}

function Alerta({ tono, icono, titulo, detalle, onClick }: {
  tono: 'ambar' | 'rojo' | 'marca' | 'neutro'
  icono: React.ReactNode
  titulo: string
  detalle: string
  onClick: () => void
}) {
  const tonos = {
    ambar: 'border-amber-200 bg-amber-50 text-amber-900',
    rojo: 'border-red-200 bg-red-50 text-red-900',
    marca: 'border-brand-200 bg-brand-50 text-brand-900',
    neutro: 'border-gray-200 bg-white text-gray-900',
  }
  return (
    <button onClick={onClick} className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-shadow hover:shadow-sm ${tonos[tono]}`}>
      <span className="shrink-0 opacity-80">{icono}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{titulo}</span>
        <span className="block truncate text-xs opacity-75">{detalle}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 opacity-50" />
    </button>
  )
}

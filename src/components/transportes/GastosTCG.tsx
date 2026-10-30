'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileCheck, Loader2, Paperclip, Plus, ReceiptText, Repeat, Truck, Wrench } from 'lucide-react'
import { aviso } from '@/components/ui/Avisos'
import { Buscador, EncabezadoPagina, EstadoVacio } from '@/components/ui/Pagina'
import { BurbujaCategoria } from '@/components/finanzas/categorias'
import SelectorMes from '@/components/finanzas/SelectorMes'
import { colorCategoria, formatoMoneda, hoyISO, mesActual, nombreMes } from '@/lib/finanzas'
import { trabajoDeGasto, type Ambito, type Camion, type GastoTCG } from '@/lib/transportes'
import CapturaGasto from './CapturaGasto'
import FijosTCG from './FijosTCG'
import { etiquetaDia } from './comunes'

export default function GastosTCG({ ambito }: { ambito: Ambito }) {
  const router = useRouter()
  const [mes, setMes] = useState(mesActual())
  const [lista, setLista] = useState<GastoTCG[]>([])
  const [camiones, setCamiones] = useState<Camion[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null)
  const [captura, setCaptura] = useState<{ g?: GastoTCG } | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/transportes/gastos?${new URLSearchParams({ ambito, mes })}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelado) setLista(j.data ?? []) })
      .catch(() => { if (!cancelado) aviso.error('No se pudieron cargar los gastos') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [ambito, mes, recarga])

  useEffect(() => {
    if (ambito !== 'empresa') return
    fetch('/api/transportes/camiones').then((r) => r.json()).then((j) => setCamiones(j.data ?? [])).catch(() => {})
  }, [ambito])

  const recargar = useCallback(() => { setCargando(true); setRecarga((n) => n + 1) }, [])

  const total = lista.reduce((a, g) => a + g.monto, 0)
  const porCategoria = Object.entries(lista.reduce<Record<string, number>>((a, g) => { a[g.categoria] = (a[g.categoria] ?? 0) + g.monto; return a }, {}))
    .sort((a, b) => b[1] - a[1])
  const q = busqueda.trim().toLowerCase()
  const visibles = lista.filter((g) =>
    (!categoriaFiltro || g.categoria === categoriaFiltro) &&
    (!q || [g.descripcion, g.proveedor, g.categoria, g.camion?.nombre, g.metodo_pago].some((t) => t?.toLowerCase().includes(q))))

  const dias = new Map<string, GastoTCG[]>()
  for (const g of visibles) dias.set(g.fecha, [...(dias.get(g.fecha) ?? []), g])
  const hoy = hoyISO()

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo={ambito === 'empresa' ? 'Gastos de la empresa' : 'Gastos del hogar'}
        subtitulo={ambito === 'empresa' ? 'Diésel, casetas, refacciones, sueldos… con foto del ticket' : 'Lo que sale para la casa'}
        acciones={
          <button onClick={() => setCaptura({})}
            className="hidden items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 sm:inline-flex">
            <Plus size={17} /> Registrar gasto
          </button>
        }
      />

      <SelectorMes mes={mes} onCambio={(m) => { setCargando(true); setCategoriaFiltro(null); setMes(m) }} />

      {/* Total y en qué se fue */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-xs text-gray-500">Gastado en {nombreMes(mes).toLowerCase()}</p>
        <p className="text-3xl font-bold tabular-nums text-gray-900">{formatoMoneda(total)}</p>
        {porCategoria.length > 0 && (
          <>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-gray-100">
              {porCategoria.map(([c, v]) => (
                <span key={c} title={`${c}: ${formatoMoneda(v)}`} style={{ width: `${(100 * v) / total}%`, backgroundColor: colorCategoria(c) }} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {porCategoria.map(([c, v]) => (
                <button key={c} type="button" onClick={() => setCategoriaFiltro(categoriaFiltro === c ? null : c)} aria-pressed={categoriaFiltro === c}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${categoriaFiltro === c
                    ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorCategoria(c) }} />
                  {c} <span className="font-semibold tabular-nums">{formatoMoneda(v)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <FijosTCG ambito={ambito} mes={mes} camiones={camiones} version={recarga} onCambio={recargar} />

      {lista.length > 0 && <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por concepto, lugar, categoría o camión…" />}

      {cargando ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<ReceiptText size={22} />}
            titulo={lista.length ? 'Sin resultados' : 'Sin gastos este mes'}
            descripcion={lista.length ? 'Prueba con otra búsqueda o categoría.' : 'Registra un gasto con el botón +.'} />
        </div>
      ) : (
        <div className="space-y-4">
          {[...dias.entries()].map(([fecha, gastos]) => (
            <section key={fecha}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{etiquetaDia(fecha, hoy)}</h3>
                <span className="text-xs font-medium text-gray-500">−{formatoMoneda(gastos.reduce((a, g) => a + g.monto, 0))}</span>
              </div>
              <ul className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02]">
                {gastos.map((g) => {
                  const trabajo = trabajoDeGasto(g)
                  const detalle = [g.descripcion ? g.categoria : null, g.proveedor, g.camion?.nombre, g.metodo_pago].filter(Boolean).join(' · ')
                  return (
                    <li key={g.id} className="border-b border-gray-100 last:border-0">
                      <button onClick={() => setCaptura({ g })} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-gray-50">
                        <BurbujaCategoria categoria={g.categoria} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-gray-900">{g.descripcion || g.categoria}</span>
                            {trabajo && <Wrench size={12} className="shrink-0 text-gray-400" aria-label="De un trabajo de camión" />}
                            {!trabajo && g.camion_id && <Truck size={12} className="shrink-0 text-gray-400" aria-label="De un camión" />}
                            {g.fijo_id && <Repeat size={12} className="shrink-0 text-gray-400" aria-label="Gasto fijo" />}
                            {g.con_factura && <FileCheck size={13} className="shrink-0 text-brand-600" aria-label="Con factura" />}
                            {g.comprobantes.length > 0 && <Paperclip size={12} className="shrink-0 text-gray-400" aria-label="Con comprobante" />}
                          </span>
                          {detalle && <span className="block truncate text-xs text-gray-500">{detalle}</span>}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">−{formatoMoneda(g.monto)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Botón flotante en celular */}
      <button onClick={() => setCaptura({})} aria-label="Registrar gasto"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-black/30 transition-transform active:scale-95 sm:hidden">
        <Plus size={26} />
      </button>

      {captura && (
        <CapturaGasto
          ambito={ambito}
          gasto={captura.g}
          camiones={camiones}
          onCerrar={() => setCaptura(null)}
          onGuardado={(g) => {
            setCaptura(null)
            aviso.exito(captura.g ? 'Cambios guardados' : 'Gasto registrado')
            if (g.fecha.slice(0, 7) !== mes) setMes(g.fecha.slice(0, 7))
            recargar()
          }}
          onEliminado={() => { setCaptura(null); aviso.exito('Gasto eliminado'); recargar() }}
          onIrATrabajo={(camionId) => router.push(camionId ? `/transportes/camiones?camion=${camionId}` : '/transportes/camiones')}
        />
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { FileText, HandCoins, History, Loader2, Wrench, X } from 'lucide-react'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { Buscador, EstadoVacio, Segmentado } from '@/components/ui/Pagina'
import { METODOS_PAGO, formatoMoneda, hoyISO } from '@/lib/finanzas'

interface PorCobrar {
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

type Filtro = 'todo' | 'cotizacion' | 'reporte'

const ESTADO: Record<string, string> = {
  aceptada: 'Aceptada', aprobada: 'Aprobada', facturada: 'Facturada',
  abierto: 'Abierto', en_proceso: 'En proceso', completado: 'Completado', entregado: 'Entregado',
}
const fechaCorta = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

function antiguedad(dias: number) {
  if (dias > 60) return { texto: `hace ${dias} días`, cls: 'bg-red-100 text-red-700' }
  if (dias > 30) return { texto: `hace ${dias} días`, cls: 'bg-amber-100 text-amber-800' }
  return { texto: dias === 0 ? 'hoy' : `hace ${dias} día${dias === 1 ? '' : 's'}`, cls: 'bg-gray-100 text-gray-600' }
}

export default function Cobranza({ onCambio }: { onCambio?: () => void }) {
  const [items, setItems] = useState<PorCobrar[] | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const [busqueda, setBusqueda] = useState('')
  const [cobrando, setCobrando] = useState<PorCobrar | null>(null)

  useEffect(() => {
    let cancelado = false
    fetch('/api/finanzas/cobranza')
      .then((r) => r.json())
      .then((j) => { if (!cancelado) setItems(j.data ?? []) })
      .catch(() => { if (!cancelado) aviso.error('No se pudo cargar la cobranza') })
    return () => { cancelado = true }
  }, [recarga])

  const recargar = () => { setRecarga((n) => n + 1); onCambio?.() }

  async function yaCobrado(i: PorCobrar) {
    if (!(await confirmar({
      titulo: `¿${i.folio} ya estaba cobrado?`,
      mensaje: `Se registra como cobrado (${formatoMoneda(i.saldo)}) con la fecha del documento, ${fechaCorta(i.fecha)}, para que no cuente como ingreso de este mes.`,
      textoConfirmar: 'Sí, ya estaba cobrado',
    }))) return
    const r = await fetch('/api/finanzas/cobranza', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origen: i.origen, id: i.id, ya_cobrado: true }),
    })
    const j = await r.json()
    if (!r.ok) return aviso.error(j.error ?? 'No se pudo registrar')
    aviso.exito(`${i.folio} marcado como cobrado`)
    recargar()
  }

  const q = busqueda.trim().toLowerCase()
  const visibles = (items ?? []).filter((i) => (filtro === 'todo' || i.origen === filtro) &&
    (!q || i.folio.toLowerCase().includes(q) || i.cliente.toLowerCase().includes(q)))
  const total = visibles.reduce((a, i) => a + i.saldo, 0)
  const vencidos = visibles.filter((i) => i.dias > 30).reduce((a, i) => a + i.saldo, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Te deben</p>
          <p className="text-2xl font-bold tabular-nums text-brand-700">{formatoMoneda(total)}</p>
          <p className="text-xs text-gray-500">{visibles.length} documento{visibles.length === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">De hace más de 30 días</p>
          <p className={`text-2xl font-bold tabular-nums ${vencidos ? 'text-red-600' : 'text-gray-900'}`}>{formatoMoneda(vencidos)}</p>
          <p className="text-xs text-gray-500">Conviene darles seguimiento</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por folio o cliente…" className="flex-1" />
        <Segmentado opciones={[{ value: 'todo', label: 'Todo' }, { value: 'cotizacion', label: 'Cotizaciones' }, { value: 'reporte', label: 'Reportes' }]}
          valor={filtro} onCambio={setFiltro} />
      </div>

      {!items ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<HandCoins size={22} />} titulo={items.length ? 'Sin resultados' : '¡Nadie te debe!'}
            descripcion={items.length ? 'Prueba con otra búsqueda.' : 'Todas las cotizaciones aceptadas y los reportes firmados están cobrados.'} />
        </div>
      ) : (
        <ul className="space-y-2">
          {visibles.map((i) => {
            const edad = antiguedad(i.dias)
            const pct = i.total ? (i.cobrado / i.total) * 100 : 0
            return (
              <li key={`${i.origen}-${i.id}`} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${i.origen === 'cotizacion' ? 'bg-green-50 text-green-700' : 'bg-teal-50 text-teal-700'}`}>
                    {i.origen === 'cotizacion' ? <FileText size={19} /> : <Wrench size={19} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs font-semibold text-brand-700">{i.folio}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{ESTADO[i.estado] ?? i.estado}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${edad.cls}`}>{edad.texto}</span>
                    </div>
                    <p className="mt-1 truncate font-medium text-gray-900">{i.cliente}</p>
                    <p className="text-xs text-gray-500">
                      Total {formatoMoneda(i.total)}{i.cobrado > 0 && <> · cobrado {formatoMoneda(i.cobrado)}</>}
                    </p>
                    {i.cobrado > 0 && (
                      <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-gray-400">Pendiente</p>
                    <p className="text-lg font-bold tabular-nums text-gray-900">{formatoMoneda(i.saldo)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button onClick={() => yaCobrado(i)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                    <History size={14} /> Ya estaba cobrado
                  </button>
                  <button onClick={() => setCobrando(i)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                    <HandCoins size={14} /> Registrar pago
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {cobrando && (
        <RegistrarPago item={cobrando} onCerrar={() => setCobrando(null)}
          onListo={(liquidado) => {
            aviso.exito(liquidado ? `${cobrando.folio} quedó liquidado` : 'Pago registrado')
            setCobrando(null)
            recargar()
          }} />
      )}
    </div>
  )
}

function RegistrarPago({ item: i, onCerrar, onListo }: { item: PorCobrar; onCerrar: () => void; onListo: (liquidado: boolean) => void }) {
  const [monto, setMonto] = useState(String(i.saldo))
  const [fecha, setFecha] = useState(hoyISO())
  const [metodo, setMetodo] = useState('Transferencia')
  const [conFactura, setConFactura] = useState(i.con_factura)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const importe = parseFloat(monto) || 0
  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none'

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      const r = await fetch('/api/finanzas/cobranza', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen: i.origen, id: i.id, monto: importe, fecha, metodo_pago: metodo || null, con_factura: conFactura }),
      })
      const j = await r.json()
      if (!r.ok) return setError(j.error ?? 'No se pudo registrar')
      onListo(j.data.liquidado)
    } catch {
      setError('Error de red')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 animate-aparecer sm:items-center sm:p-4" onMouseDown={onCerrar}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl bg-white shadow-2xl animate-subir sm:rounded-3xl">
        <div className="flex items-start justify-between px-5 pb-2 pt-4">
          <div>
            <h2 className="font-semibold text-gray-900">Registrar pago · {i.folio}</h2>
            <p className="text-sm text-gray-500">{i.cliente} · pendiente {formatoMoneda(i.saldo)}</p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="space-y-4 px-5 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Monto recibido</span>
              <input value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inputCls} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Fecha</span>
              <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></label>
          </div>
          {importe > 0 && importe < i.saldo && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Pago parcial: quedará pendiente {formatoMoneda(i.saldo - importe)}.</p>
          )}
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-500">¿Cómo pagó?</span>
            <div className="flex flex-wrap gap-1.5">
              {METODOS_PAGO.map((mp) => (
                <button key={mp} type="button" onClick={() => setMetodo(metodo === mp ? '' : mp)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${metodo === mp ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {mp}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={conFactura} onChange={(e) => setConFactura(e.target.checked)} className="rounded" /> Se facturó
          </label>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
        </div>
        <div className="border-t border-gray-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={guardar} disabled={guardando || !(importe > 0) || importe > i.saldo + 0.009}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
            {guardando && <Loader2 size={16} className="animate-spin" />} Registrar {formatoMoneda(importe)}
          </button>
        </div>
      </div>
    </div>
  )
}

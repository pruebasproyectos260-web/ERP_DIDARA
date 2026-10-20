'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, ReceiptText, ShieldCheck } from 'lucide-react'
import { aviso } from '@/components/ui/Avisos'
import { Buscador, EstadoVacio, Segmentado } from '@/components/ui/Pagina'
import { formatoMoneda, type Movimiento, type TipoMovimiento } from '@/lib/finanzas'
import SelectorMes from './SelectorMes'
import ListaMovimientos from './ListaMovimientos'
import CapturaMovimiento from './CapturaMovimiento'

type Filtro = 'todos' | TipoMovimiento

interface Props {
  /** Administración/contabilidad (todo) o equipo de campo (solo sus gastos) */
  completo: boolean
  clientes?: { id: number; nombre: string }[]
  mes: string
  onMes: (mes: string) => void
  /** Abrir directamente la lista de "por revisar" (desde el resumen) */
  porRevisarInicial?: boolean
  onCambio?: () => void
}

export default function Movimientos({ completo, clientes, mes, onMes, porRevisarInicial = false, onCambio }: Props) {
  const [lista, setLista] = useState<Movimiento[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [porRevisar, setPorRevisar] = useState(porRevisarInicial)
  const [busqueda, setBusqueda] = useState('')
  const [captura, setCaptura] = useState<{ m?: Movimiento } | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    // "Por revisar" muestra todos los pendientes, de cualquier mes
    const params = new URLSearchParams(porRevisar ? { revisado: 'false' } : { mes })
    fetch(`/api/finanzas/movimientos?${params}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelado) setLista(j.data ?? []) })
      .catch(() => { if (!cancelado) aviso.error('No se pudieron cargar los movimientos') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [mes, porRevisar, recarga])

  const recargar = useCallback(() => { setCargando(true); setRecarga((n) => n + 1); onCambio?.() }, [onCambio])

  const q = busqueda.trim().toLowerCase()
  const visibles = lista.filter((m) =>
    (filtro === 'todos' || m.tipo === filtro) &&
    (!q || [m.descripcion, m.proveedor, m.categoria, m.registrado_nombre, m.cliente?.nombre].some((t) => t?.toLowerCase().includes(q))))

  const entradas = lista.filter((m) => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0)
  const salidas = lista.filter((m) => m.tipo === 'gasto').reduce((a, m) => a + m.monto, 0)

  async function revisar(m: Movimiento) {
    const r = await fetch(`/api/finanzas/movimientos/${m.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisado: true }),
    })
    const j = await r.json()
    if (!r.ok) return aviso.error(j.error ?? 'No se pudo marcar')
    setLista((p) => porRevisar ? p.filter((x) => x.id !== m.id) : p.map((x) => (x.id === m.id ? j.data : x)))
    onCambio?.()
  }

  function cambiarMes(nuevo: string) { setCargando(true); setPorRevisar(false); onMes(nuevo) }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        {!porRevisar && <SelectorMes mes={mes} onCambio={cambiarMes} />}
        {completo && (
          <button onClick={() => { setCargando(true); setPorRevisar((v) => !v) }} aria-pressed={porRevisar}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${porRevisar
              ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
            <ShieldCheck size={15} /> {porRevisar ? 'Viendo: por revisar' : 'Por revisar'}
          </button>
        )}
        <button onClick={() => setCaptura({})}
          className="ml-auto hidden items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 sm:inline-flex">
          <Plus size={17} /> {completo ? 'Registrar' : 'Registrar gasto'}
        </button>
      </div>

      {/* Totales del periodo */}
      {!porRevisar && (
        completo ? (
          <div className="grid grid-cols-3 gap-2">
            <Total titulo="Entró" valor={entradas} cls="text-green-600" />
            <Total titulo="Salió" valor={salidas} cls="text-gray-900" />
            <Total titulo="Quedó" valor={entradas - salidas} cls={entradas - salidas >= 0 ? 'text-brand-700' : 'text-red-600'} />
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Gastaste este mes</p>
            <p className="text-2xl font-bold tabular-nums text-gray-900">{formatoMoneda(salidas)}</p>
            <p className="mt-1 text-xs text-gray-500">Administración revisa tus gastos; ya revisados no se pueden editar.</p>
          </div>
        )
      )}

      {completo && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por concepto, lugar, categoría o persona…" className="flex-1" />
          <Segmentado opciones={[{ value: 'todos', label: 'Todos' }, { value: 'gasto', label: 'Gastos' }, { value: 'ingreso', label: 'Ingresos' }]}
            valor={filtro} onCambio={setFiltro} />
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<ReceiptText size={22} />}
            titulo={porRevisar ? 'Todo revisado' : lista.length ? 'Sin resultados' : 'Sin movimientos este mes'}
            descripcion={porRevisar ? 'No hay gastos pendientes de revisar.' : lista.length ? 'Prueba con otra búsqueda o filtro.' : 'Registra un gasto con el botón +.'} />
        </div>
      ) : (
        <ListaMovimientos movimientos={visibles} completo={completo} onAbrir={(m) => setCaptura({ m })} onRevisar={revisar} />
      )}

      {/* Botón flotante en celular */}
      <button onClick={() => setCaptura({})} aria-label="Registrar gasto"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-900/30 transition-transform active:scale-95 sm:hidden">
        <Plus size={26} />
      </button>

      {captura && (
        <CapturaMovimiento
          movimiento={captura.m}
          completo={completo}
          clientes={clientes}
          onCerrar={() => setCaptura(null)}
          onGuardado={(m) => {
            setCaptura(null)
            aviso.exito(captura.m ? 'Cambios guardados' : m.tipo === 'gasto' ? 'Gasto registrado' : 'Ingreso registrado')
            if (!captura.m && m.fecha.slice(0, 7) !== mes) onMes(m.fecha.slice(0, 7))
            recargar()
          }}
          onEliminado={() => { setCaptura(null); aviso.exito('Eliminado'); recargar() }}
        />
      )}
    </div>
  )
}

function Total({ titulo, valor, cls }: { titulo: string; valor: number; cls: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{titulo}</p>
      <p className={`truncate text-base font-bold tabular-nums sm:text-lg ${cls}`}>{formatoMoneda(valor)}</p>
    </div>
  )
}

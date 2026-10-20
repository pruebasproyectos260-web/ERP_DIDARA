'use client'

import { useRef, useState } from 'react'
import { BadgeCheck, Camera, FileText, Loader2, Trash2, X } from 'lucide-react'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { comprimirImagen } from '@/lib/comprimir-imagen'
import {
  CATEGORIAS_GASTO, CATEGORIAS_INGRESO, METODOS_PAGO, colorCategoria, formatoMoneda, hoyISO, ivaIncluido,
  type Movimiento, type TipoMovimiento,
} from '@/lib/finanzas'
import { BurbujaCategoria } from './categorias'

const METODO_CORTO: Record<string, string> = {
  Efectivo: 'Efectivo', 'Tarjeta de débito': 'Débito', 'Tarjeta de crédito': 'Crédito', Transferencia: 'Transferencia',
}
const CLAVE_METODO = 'finanzas_ultimo_metodo'

const leerNumero = (t: string) => {
  const n = parseFloat(t.replace(/[$\s,]/g, ''))
  return Number.isFinite(n) ? n : 0
}
export const urlComprobante = (ruta: string) => `/api/finanzas/comprobantes?ruta=${encodeURIComponent(ruta)}`

interface Props {
  movimiento?: Movimiento
  /** Administración/contabilidad: también registra ingresos y elige cliente */
  completo: boolean
  clientes?: { id: number; nombre: string }[]
  tipoInicial?: TipoMovimiento
  onCerrar: () => void
  onGuardado: (m: Movimiento) => void
  onEliminado?: (id: number) => void
}

export default function CapturaMovimiento({ movimiento: m, completo, clientes = [], tipoInicial = 'gasto', onCerrar, onGuardado, onEliminado }: Props) {
  const soloLectura = !!m && !completo && m.revisado
  const [tipo, setTipo] = useState<TipoMovimiento>(m?.tipo ?? tipoInicial)
  const [montoTexto, setMontoTexto] = useState(m ? String(m.monto) : '')
  const [categoria, setCategoria] = useState(m?.categoria ?? '')
  const [fecha, setFecha] = useState(m?.fecha ?? hoyISO())
  const [metodo, setMetodo] = useState<string>(() => {
    if (m) return m.metodo_pago ?? ''
    try { return localStorage.getItem(CLAVE_METODO) ?? '' } catch { return '' }
  })
  const [descripcion, setDescripcion] = useState(m?.descripcion ?? '')
  const [proveedor, setProveedor] = useState(m?.proveedor ?? '')
  const [conFactura, setConFactura] = useState(m?.con_factura ?? false)
  const [ivaTexto, setIvaTexto] = useState(m?.iva != null ? String(m.iva) : '')
  const [ivaTocado, setIvaTocado] = useState(m?.iva != null)
  const [clienteId, setClienteId] = useState(m?.cliente_id ? String(m.cliente_id) : '')
  const [comprobantes, setComprobantes] = useState<string[]>(m?.comprobantes ?? [])
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const subidosAqui = useRef<string[]>([]) // fotos nuevas: si se cancela, se borran
  const inputArchivo = useRef<HTMLInputElement>(null)

  const monto = leerNumero(montoTexto)
  const ivaMostrado = ivaTocado ? ivaTexto : conFactura && monto > 0 ? ivaIncluido(monto).toFixed(2) : ''
  const categorias = tipo === 'gasto' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO
  // Categorías viejas que ya no están en la lista (p. ej. tipos escritos a mano) se siguen mostrando
  const opciones = categoria && !(categorias as readonly string[]).includes(categoria) ? [...categorias, categoria] : categorias

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    if (comprobantes.length >= 5) return aviso.error('Máximo 5 comprobantes por movimiento')
    setSubiendo(true)
    try {
      const form = new FormData()
      form.append('archivo', await comprimirImagen(archivo))
      const r = await fetch('/api/finanzas/comprobantes', { method: 'POST', body: form })
      const j = await r.json()
      if (!r.ok) return aviso.error(j.error ?? 'No se pudo subir la foto')
      subidosAqui.current.push(j.data.ruta)
      setComprobantes((c) => [...c, j.data.ruta])
    } catch {
      aviso.error('Error de red al subir la foto')
    } finally {
      setSubiendo(false)
    }
  }

  function quitarComprobante(ruta: string) {
    setComprobantes((c) => c.filter((x) => x !== ruta))
    if (subidosAqui.current.includes(ruta)) {
      subidosAqui.current = subidosAqui.current.filter((x) => x !== ruta)
      void fetch(urlComprobante(ruta), { method: 'DELETE' })
    }
  }

  function cerrar() {
    for (const ruta of subidosAqui.current) void fetch(urlComprobante(ruta), { method: 'DELETE' })
    onCerrar()
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!(monto > 0)) return setError('Escribe el monto')
    if (!categoria) return setError('Elige una categoría')
    const iva = conFactura && ivaMostrado ? leerNumero(ivaMostrado) : null
    setGuardando(true)
    try {
      const r = await fetch(m ? `/api/finanzas/movimientos/${m.id}` : '/api/finanzas/movimientos', {
        method: m ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, fecha, categoria, monto,
          descripcion: descripcion.trim() || null,
          proveedor: proveedor.trim() || null,
          metodo_pago: metodo || null,
          con_factura: conFactura,
          iva,
          comprobantes,
          ...(completo ? { cliente_id: clienteId ? Number(clienteId) : null } : {}),
        }),
      })
      const j = await r.json()
      if (!r.ok) return setError(j.error ?? 'No se pudo guardar')
      try { if (metodo) localStorage.setItem(CLAVE_METODO, metodo) } catch { /* sin almacenamiento */ }
      subidosAqui.current = []
      onGuardado(j.data)
    } catch {
      setError('Error de red. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!m) return
    if (!(await confirmar({ titulo: `¿Eliminar este ${m.tipo}?`, mensaje: `${m.categoria} · ${formatoMoneda(m.monto)}. Se borran también sus fotos.`, peligro: true }))) return
    const r = await fetch(`/api/finanzas/movimientos/${m.id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return aviso.error(j.error ?? 'No se pudo eliminar')
    onEliminado?.(m.id)
  }

  const esGasto = tipo === 'gasto'
  const acento = esGasto ? 'text-red-600' : 'text-green-600'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 animate-aparecer sm:items-center sm:p-4" onMouseDown={cerrar}>
      <form onSubmit={guardar} onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl animate-subir sm:rounded-3xl">
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          {completo && !m ? (
            <div className="inline-flex rounded-xl bg-gray-100 p-1">
              {(['gasto', 'ingreso'] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setTipo(t); setCategoria('') }}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${tipo === t
                    ? `bg-white shadow-sm ${t === 'gasto' ? 'text-red-600' : 'text-green-600'}` : 'text-gray-500'}`}>
                  {t === 'gasto' ? 'Gasto' : 'Ingreso'}
                </button>
              ))}
            </div>
          ) : (
            <h2 className="text-base font-semibold text-gray-900">
              {soloLectura ? 'Detalle del gasto' : m ? `Editar ${m.tipo}` : 'Registrar gasto'}
            </h2>
          )}
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-4">
          {soloLectura && (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <BadgeCheck size={15} /> Revisado por {m.revisado_por ?? 'administración'}: ya no se puede editar.
            </p>
          )}

          {/* Monto */}
          <label className="block text-center">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Monto</span>
            <div className={`mt-1 flex items-baseline justify-center gap-1 ${acento}`}>
              <span className="text-3xl font-semibold">{esGasto ? '−' : '+'}$</span>
              <input value={montoTexto} onChange={(e) => setMontoTexto(e.target.value.replace(/[^\d.,]/g, ''))}
                inputMode="decimal" autoFocus={!m} disabled={soloLectura} placeholder="0.00" aria-label="Monto"
                // El ancho sigue al número para que el "$" quede pegado a la cantidad
                style={{ width: `${Math.min(Math.max(montoTexto.length, 4), 11) + 0.5}ch` }}
                className="bg-transparent text-left text-5xl font-bold tracking-tight outline-none placeholder:text-gray-200" />
            </div>
          </label>

          {/* Categoría */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">Categoría</p>
            <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
              {opciones.map((c) => {
                const activa = categoria === c
                return (
                  <button key={c} type="button" disabled={soloLectura} onClick={() => setCategoria(c)}
                    className="group flex flex-col items-center gap-1.5 rounded-2xl py-1 disabled:opacity-60">
                    <span className="rounded-full transition-transform group-active:scale-95"
                      style={activa ? { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${colorCategoria(c)}` } : undefined}>
                      <BurbujaCategoria categoria={c} tamano={46} />
                    </span>
                    <span className={`text-[11px] leading-tight ${activa ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{c}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fecha y método */}
          <div className="grid gap-3 sm:grid-cols-[auto,1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Fecha</span>
              <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} disabled={soloLectura} required
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
            </label>
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-500">{esGasto ? '¿Con qué se pagó?' : '¿Cómo se cobró?'}</span>
              <div className="flex flex-wrap gap-1.5">
                {METODOS_PAGO.map((mp) => (
                  <button key={mp} type="button" disabled={soloLectura} onClick={() => setMetodo(metodo === mp ? '' : mp)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${metodo === mp
                      ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {METODO_CORTO[mp]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Detalle */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">{esGasto ? '¿En qué fue?' : 'Concepto'}</span>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} disabled={soloLectura}
                placeholder={esGasto ? 'Ej. Cable UTP para Grupo CAL' : 'Ej. Anticipo instalación'}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
            </label>
            {esGasto || !completo ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">Lugar o proveedor</span>
                <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} maxLength={150} disabled={soloLectura}
                  placeholder="Ej. Pemex, Home Depot, Syscom"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">Cliente</span>
                <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none">
                  <option value="">Sin cliente</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
            )}
          </div>

          {/* Factura */}
          <div className="rounded-2xl border border-gray-200 p-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-medium text-gray-900">Con factura</span>
                <span className="block text-xs text-gray-500">{esGasto ? 'Para que contabilidad lo pueda deducir' : 'Se emitió factura de este ingreso'}</span>
              </span>
              <input type="checkbox" checked={conFactura} disabled={soloLectura} onChange={(e) => setConFactura(e.target.checked)}
                className="peer sr-only" />
              <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-brand-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/20" />
            </label>
            {conFactura && (
              <label className="mt-3 flex items-center gap-3">
                <span className="text-xs text-gray-500">IVA incluido</span>
                <input value={ivaMostrado} onChange={(e) => { setIvaTocado(true); setIvaTexto(e.target.value.replace(/[^\d.,]/g, '')) }}
                  inputMode="decimal" disabled={soloLectura}
                  className="w-32 rounded-lg border border-gray-200 px-2.5 py-1.5 text-right text-sm focus:border-brand-500 focus:outline-none" />
                {ivaTocado && !soloLectura && (
                  <button type="button" onClick={() => { setIvaTocado(false); setIvaTexto('') }} className="text-xs text-brand-700 hover:underline">16 %</button>
                )}
              </label>
            )}
          </div>

          {/* Comprobantes */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">Foto del ticket o factura</p>
            <div className="flex flex-wrap gap-2">
              {comprobantes.map((ruta) => (
                <div key={ruta} className="relative">
                  <a href={urlComprobante(ruta)} target="_blank" rel="noopener noreferrer"
                    className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                    {ruta.endsWith('.pdf')
                      ? <FileText size={28} className="text-gray-400" />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={urlComprobante(ruta)} alt="Comprobante" className="h-full w-full object-cover" />}
                  </a>
                  {!soloLectura && (
                    <button type="button" onClick={() => quitarComprobante(ruta)} aria-label="Quitar foto"
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-900 p-1 text-white shadow">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {!soloLectura && comprobantes.length < 5 && (
                <button type="button" onClick={() => inputArchivo.current?.click()} disabled={subiendo}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-700 disabled:opacity-60">
                  {subiendo ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                  <span className="text-[11px] font-medium">{subiendo ? 'Subiendo' : 'Agregar'}</span>
                </button>
              )}
              {soloLectura && comprobantes.length === 0 && <p className="text-xs text-gray-400">Sin comprobante</p>}
            </div>
            <input ref={inputArchivo} type="file" accept="image/*,application/pdf" onChange={subir} className="hidden" />
          </div>

          {m && (
            <p className="text-xs text-gray-400">
              Registrado por {m.registrado_nombre ?? '—'}
              {m.revisado && m.revisado_por && completo ? ` · revisado por ${m.revisado_por}` : ''}
              {m.cotizacion ? ` · Cotización ${m.cotizacion.folio}` : ''}
              {m.reporte ? ` · Reporte ${m.reporte.folio}` : ''}
              {m.importado ? ' · importado del sistema anterior' : ''}
            </p>
          )}

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
        </div>

        {/* Acciones */}
        {!soloLectura && (
          <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {m && onEliminado && (
              <button type="button" onClick={eliminar} aria-label="Eliminar" title="Eliminar"
                className="rounded-xl p-3 text-gray-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={18} />
              </button>
            )}
            <button type="submit" disabled={guardando || subiendo}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60 ${
                esGasto ? 'bg-brand-600 hover:bg-brand-700' : 'bg-green-600 hover:bg-green-700'}`}>
              {guardando && <Loader2 size={16} className="animate-spin" />}
              {m ? 'Guardar cambios' : esGasto ? 'Guardar gasto' : 'Guardar ingreso'}
              {monto > 0 && !m && <span className="font-normal opacity-80">· {formatoMoneda(monto)}</span>}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

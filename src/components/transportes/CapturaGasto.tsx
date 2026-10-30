'use client'

import { useState } from 'react'
import { Loader2, Trash2, Wrench } from 'lucide-react'
import { confirmar } from '@/components/ui/Avisos'
import { BurbujaCategoria } from '@/components/finanzas/categorias'
import { colorCategoria, formatoMoneda, hoyISO, ivaIncluido } from '@/lib/finanzas'
import { CATEGORIAS_TCG, ETIQUETA_TRABAJO, trabajoDeGasto, type Ambito, type Camion, type GastoTCG } from '@/lib/transportes'
import { claseCampo, FotosComprobante, HojaCaptura, Interruptor, leerNumero, MetodoPago, useComprobantes } from './comunes'

const CLAVE_METODO = 'tcg_ultimo_metodo'

interface Props {
  ambito: Ambito
  gasto?: GastoTCG
  camiones: Camion[]
  onCerrar: () => void
  onGuardado: (g: GastoTCG) => void
  onEliminado: () => void
  /** Gastos que salieron de un trabajo: se abren en Camiones */
  onIrATrabajo: (camionId: number | null) => void
}

export default function CapturaGasto({ ambito, gasto: g, camiones, onCerrar, onGuardado, onEliminado, onIrATrabajo }: Props) {
  const trabajo = g ? trabajoDeGasto(g) : null
  const soloLectura = !!trabajo
  const [montoTexto, setMontoTexto] = useState(g ? String(g.monto) : '')
  const [categoria, setCategoria] = useState(g?.categoria ?? '')
  const [fecha, setFecha] = useState(g?.fecha ?? hoyISO())
  const [metodo, setMetodo] = useState<string>(() => {
    if (g) return g.metodo_pago ?? ''
    try { return localStorage.getItem(CLAVE_METODO) ?? '' } catch { return '' }
  })
  const [descripcion, setDescripcion] = useState(g?.descripcion ?? '')
  const [proveedor, setProveedor] = useState(g?.proveedor ?? '')
  const [camionId, setCamionId] = useState(g?.camion_id ? String(g.camion_id) : '')
  const [conFactura, setConFactura] = useState(g?.con_factura ?? false)
  const [ivaTexto, setIvaTexto] = useState(g?.iva != null ? String(g.iva) : '')
  const [ivaTocado, setIvaTocado] = useState(g?.iva != null)
  const fotos = useComprobantes(g?.comprobantes)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const monto = leerNumero(montoTexto)
  const ivaMostrado = ivaTocado ? ivaTexto : conFactura && monto > 0 ? ivaIncluido(monto).toFixed(2) : ''
  const categorias = CATEGORIAS_TCG[ambito]
  const opciones = categoria && !categorias.includes(categoria) ? [...categorias, categoria] : categorias
  const camionesVisibles = camiones.filter((c) => c.activo || String(c.id) === camionId)

  function cerrar() { fotos.descartar(); onCerrar() }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!(monto > 0)) return setError('Escribe el monto')
    if (!categoria) return setError('Elige una categoría')
    setGuardando(true)
    try {
      const r = await fetch(g ? `/api/transportes/gastos/${g.id}` : '/api/transportes/gastos', {
        method: g ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambito, fecha, categoria, monto,
          descripcion: descripcion.trim() || null,
          proveedor: proveedor.trim() || null,
          metodo_pago: metodo || null,
          con_factura: conFactura,
          iva: conFactura && ivaMostrado ? leerNumero(ivaMostrado) : null,
          comprobantes: fotos.comprobantes,
          camion_id: ambito === 'empresa' && camionId ? Number(camionId) : null,
        }),
      })
      const j = await r.json()
      if (!r.ok) return setError(j.error ?? 'No se pudo guardar')
      try { if (metodo) localStorage.setItem(CLAVE_METODO, metodo) } catch { /* sin almacenamiento */ }
      fotos.confirmar()
      onGuardado(j.data)
    } catch {
      setError('Error de red. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!g) return
    if (!(await confirmar({ titulo: '¿Eliminar este gasto?', mensaje: `${g.categoria} · ${formatoMoneda(g.monto)}. Se borran también sus fotos.`, peligro: true }))) return
    const r = await fetch(`/api/transportes/gastos/${g.id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return setError(j.error ?? 'No se pudo eliminar')
    onEliminado()
  }

  return (
    <HojaCaptura
      titulo={soloLectura ? 'Gasto de un trabajo' : g ? 'Editar gasto' : ambito === 'hogar' ? 'Gasto del hogar' : 'Gasto de la empresa'}
      onCerrar={cerrar}
      onEnviar={guardar}
      pie={soloLectura ? (
        <button type="button" onClick={() => onIrATrabajo(g?.camion_id ?? null)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          <Wrench size={16} /> Ver el trabajo en Camiones
        </button>
      ) : (
        <>
          {g && (
            <button type="button" onClick={eliminar} aria-label="Eliminar" title="Eliminar"
              className="rounded-xl p-3 text-gray-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={18} />
            </button>
          )}
          <button type="submit" disabled={guardando || fotos.subiendo}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
            {guardando && <Loader2 size={16} className="animate-spin" />}
            {g ? 'Guardar cambios' : 'Guardar gasto'}
            {monto > 0 && !g && <span className="font-normal opacity-80">· {formatoMoneda(monto)}</span>}
          </button>
        </>
      )}
    >
      {soloLectura && trabajo && (
        <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">
          <Wrench size={15} className="mt-px shrink-0" />
          Viene de un trabajo {ETIQUETA_TRABAJO[trabajo.tipo].toLowerCase()} de {g?.camion?.nombre ?? 'un camión'}. Para cambiarlo o borrarlo, ábrelo en Camiones.
        </p>
      )}

      {/* Monto */}
      <label className="block text-center">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Monto</span>
        <div className="mt-1 flex items-baseline justify-center gap-1 text-red-600">
          <span className="text-3xl font-semibold">−$</span>
          <input value={montoTexto} onChange={(e) => setMontoTexto(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal" autoFocus={!g} disabled={soloLectura} placeholder="0.00" aria-label="Monto"
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
          <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} disabled={soloLectura} required className={claseCampo} />
        </label>
        <div>
          <span className="mb-1 block text-xs font-medium text-gray-500">¿Con qué se pagó?</span>
          <MetodoPago valor={metodo} onCambio={setMetodo} disabled={soloLectura} />
        </div>
      </div>

      {/* Detalle */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">¿En qué fue?</span>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} disabled={soloLectura}
            placeholder={ambito === 'hogar' ? 'Ej. Despensa de la semana' : 'Ej. Diésel ruta Puebla'} className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Lugar o proveedor</span>
          <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} maxLength={150} disabled={soloLectura}
            placeholder={ambito === 'hogar' ? 'Ej. Walmart, CFE' : 'Ej. Pemex, refaccionaria'} className={claseCampo} />
        </label>
      </div>

      {ambito === 'empresa' && camionesVisibles.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Camión (opcional)</span>
          <select value={camionId} onChange={(e) => setCamionId(e.target.value)} disabled={soloLectura} className={claseCampo}>
            <option value="">De la empresa en general</option>
            {camionesVisibles.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.placas ? ` · ${c.placas}` : ''}</option>)}
          </select>
        </label>
      )}

      {/* Factura */}
      <div className="rounded-2xl border border-gray-200 p-3">
        <Interruptor titulo="Con factura" detalle="El IVA viene incluido en el monto" valor={conFactura} onCambio={setConFactura} disabled={soloLectura} />
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

      <FotosComprobante c={fotos} soloLectura={soloLectura} />

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
    </HojaCaptura>
  )
}

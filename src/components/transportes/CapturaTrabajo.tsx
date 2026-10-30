'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { confirmar } from '@/components/ui/Avisos'
import { formatoMoneda, hoyISO, ivaIncluido } from '@/lib/finanzas'
import { COLOR_TRABAJO, ETIQUETA_TRABAJO, TIPOS_TRABAJO, type Camion, type TipoTrabajo, type Trabajo } from '@/lib/transportes'
import { claseCampo, FotosComprobante, HojaCaptura, Interruptor, leerNumero, MetodoPago, useComprobantes } from './comunes'

interface Props {
  trabajo?: Trabajo
  camiones: Camion[]
  camionInicial?: number | null
  onCerrar: () => void
  onGuardado: (t: Trabajo) => void
  onEliminado: () => void
}

export default function CapturaTrabajo({ trabajo: t, camiones, camionInicial, onCerrar, onGuardado, onEliminado }: Props) {
  const [camionId, setCamionId] = useState(String(t?.camion_id ?? camionInicial ?? (camiones.filter((c) => c.activo).length === 1 ? camiones.find((c) => c.activo)!.id : '')))
  const [fecha, setFecha] = useState(t?.fecha ?? hoyISO())
  const [tipo, setTipo] = useState<TipoTrabajo | ''>(t?.tipo ?? '')
  const [descripcion, setDescripcion] = useState(t?.descripcion ?? '')
  const [taller, setTaller] = useState(t?.taller ?? '')
  const [kmTexto, setKmTexto] = useState(t?.kilometraje != null ? String(t.kilometraje) : '')
  const [costoTexto, setCostoTexto] = useState(t && t.costo > 0 ? String(t.costo) : '')
  const [notas, setNotas] = useState(t?.notas ?? '')
  const [metodo, setMetodo] = useState(t?.gasto?.metodo_pago ?? '')
  const [conFactura, setConFactura] = useState(t?.gasto?.con_factura ?? false)
  const [ivaTexto, setIvaTexto] = useState(t?.gasto?.iva != null ? String(t.gasto.iva) : '')
  const [ivaTocado, setIvaTocado] = useState(t?.gasto?.iva != null)
  const fotos = useComprobantes(t?.gasto?.comprobantes)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const costo = leerNumero(costoTexto)
  const ivaMostrado = ivaTocado ? ivaTexto : conFactura && costo > 0 ? ivaIncluido(costo).toFixed(2) : ''
  const camionesVisibles = camiones.filter((c) => c.activo || String(c.id) === camionId)

  function cerrar() { fotos.descartar(); onCerrar() }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!camionId) return setError('Elige el camión')
    if (!tipo) return setError('Elige el tipo de trabajo')
    if (descripcion.trim().length < 2) return setError('Describe el trabajo')
    setGuardando(true)
    try {
      const r = await fetch(t ? `/api/transportes/trabajos/${t.id}` : '/api/transportes/trabajos', {
        method: t ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camion_id: Number(camionId), fecha, tipo,
          descripcion: descripcion.trim(),
          taller: taller.trim() || null,
          kilometraje: kmTexto ? Math.round(leerNumero(kmTexto)) : null,
          costo,
          notas: notas.trim() || null,
          metodo_pago: metodo || null,
          con_factura: costo > 0 && conFactura,
          iva: costo > 0 && conFactura && ivaMostrado ? leerNumero(ivaMostrado) : null,
          comprobantes: costo > 0 ? fotos.comprobantes : [],
        }),
      })
      const j = await r.json()
      if (!r.ok) return setError(j.error ?? 'No se pudo guardar')
      // Sin costo no hay gasto donde guardar las fotos nuevas
      if (costo > 0) fotos.confirmar()
      else fotos.descartar()
      onGuardado(j.data)
    } catch {
      setError('Error de red. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!t) return
    const mensaje = t.costo > 0 ? `Se borra también su gasto de ${formatoMoneda(t.costo)} en Gastos de la empresa, con sus fotos.` : 'No se puede deshacer.'
    if (!(await confirmar({ titulo: '¿Eliminar este trabajo?', mensaje, peligro: true }))) return
    const r = await fetch(`/api/transportes/trabajos/${t.id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return setError(j.error ?? 'No se pudo eliminar')
    onEliminado()
  }

  return (
    <HojaCaptura
      titulo={t ? 'Editar trabajo' : 'Registrar trabajo'}
      onCerrar={cerrar}
      onEnviar={guardar}
      pie={
        <>
          {t && (
            <button type="button" onClick={eliminar} aria-label="Eliminar" title="Eliminar"
              className="rounded-xl p-3 text-gray-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={18} />
            </button>
          )}
          <button type="submit" disabled={guardando || fotos.subiendo}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
            {guardando && <Loader2 size={16} className="animate-spin" />}
            {t ? 'Guardar cambios' : 'Guardar trabajo'}
            {costo > 0 && !t && <span className="font-normal opacity-80">· {formatoMoneda(costo)}</span>}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Camión</span>
          <select value={camionId} onChange={(e) => setCamionId(e.target.value)} required className={claseCampo}>
            <option value="">Elige el camión</option>
            {camionesVisibles.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.placas ? ` · ${c.placas}` : ''}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Fecha</span>
          <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} required className={claseCampo} />
        </label>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-gray-500">Tipo de trabajo</p>
        <div className="flex flex-wrap gap-1.5">
          {TIPOS_TRABAJO.map((tt) => (
            <button key={tt} type="button" onClick={() => setTipo(tt)} aria-pressed={tipo === tt}
              className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
              style={tipo === tt
                ? { backgroundColor: COLOR_TRABAJO[tt], borderColor: COLOR_TRABAJO[tt], color: '#fff' }
                : { borderColor: '#e5e7eb', color: COLOR_TRABAJO[tt] }}>
              {ETIQUETA_TRABAJO[tt]}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">¿Qué se le hizo?</span>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={500} rows={3} required
          placeholder="Ej. Cambio de balatas delanteras y rectificado de discos" className={claseCampo} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Taller o quién lo hizo</span>
          <input value={taller} onChange={(e) => setTaller(e.target.value)} maxLength={150} placeholder="Ej. Taller Hernández" className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Kilometraje (opcional)</span>
          <input value={kmTexto} onChange={(e) => setKmTexto(e.target.value.replace(/[^\d,]/g, ''))} inputMode="numeric" placeholder="Ej. 452,300" className={claseCampo} />
        </label>
      </div>

      <div className="rounded-2xl border border-gray-200 p-3">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-gray-900">Costo</span>
            <span className="block text-xs text-gray-500">Si costó algo, se registra solo en Gastos de la empresa</span>
          </span>
          <span className="flex items-baseline gap-1">
            <span className="text-sm text-gray-500">$</span>
            <input value={costoTexto} onChange={(e) => setCostoTexto(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="0.00"
              aria-label="Costo" className="w-32 rounded-lg border border-gray-200 px-2.5 py-1.5 text-right text-sm font-semibold focus:border-brand-500 focus:outline-none" />
          </span>
        </label>
        {costo > 0 && (
          <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-500">¿Con qué se pagó?</span>
              <MetodoPago valor={metodo} onCambio={setMetodo} />
            </div>
            <Interruptor titulo="Con factura" detalle="El IVA viene incluido en el costo" valor={conFactura} onCambio={setConFactura} />
            {conFactura && (
              <label className="flex items-center gap-3">
                <span className="text-xs text-gray-500">IVA incluido</span>
                <input value={ivaMostrado} onChange={(e) => { setIvaTocado(true); setIvaTexto(e.target.value.replace(/[^\d.,]/g, '')) }}
                  inputMode="decimal" className="w-32 rounded-lg border border-gray-200 px-2.5 py-1.5 text-right text-sm focus:border-brand-500 focus:outline-none" />
                {ivaTocado && (
                  <button type="button" onClick={() => { setIvaTocado(false); setIvaTexto('') }} className="text-xs text-brand-700 hover:underline">16 %</button>
                )}
              </label>
            )}
            <FotosComprobante c={fotos} titulo="Foto del ticket, factura o del trabajo" />
          </div>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">Notas (opcional)</span>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej. Garantía de 6 meses" className={claseCampo} />
      </label>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
    </HojaCaptura>
  )
}

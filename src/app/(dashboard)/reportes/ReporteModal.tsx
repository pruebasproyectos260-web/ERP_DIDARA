'use client'

import { useRef, useState } from 'react'
import { X, Plus, Trash2, Upload, ImageOff } from 'lucide-react'
import type { Reporte } from '@/types'
import type { ClienteParaReporte, TecnicoParaReporte } from './ReportesClient'

interface Props {
  reporte: Reporte | null
  clientes: ClienteParaReporte[]
  tecnicos: TecnicoParaReporte[]
  onClose: () => void
  onGuardado: (reporte: Reporte) => void
}

const TIPOS_SERVICIO = [
  'Mantenimiento Preventivo',
  'Mantenimiento Correctivo',
  'Soporte Técnico',
  'Reparación',
]

interface MaterialForm {
  descripcion: string
  cantidad: number
  costo: number
}

interface EvidenciaForm {
  urls: string[]
  descripcion: string
  uploading: boolean
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1'
const sectionCls = 'bg-white rounded-xl border border-gray-200 p-4 space-y-3'
const sectionTitleCls = 'text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2 mb-3'

export default function ReporteModal({ reporte, clientes, tecnicos, onClose, onGuardado }: Props) {
  const esNuevo = !reporte
  // Carpeta en Storage: ID del reporte si existe, UUID nuevo si es creación
  const [sesion] = useState<string>(() =>
    reporte ? String(reporte.id) : crypto.randomUUID()
  )

  // ── Cliente con búsqueda ─────────────────────────────────────
  const [clienteQuery, setClienteQuery] = useState(
    reporte ? (reporte.cliente as { nombre?: string } | undefined)?.nombre ?? '' : ''
  )
  const [clienteId, setClienteId] = useState(reporte?.cliente_id?.toString() ?? '')
  const [showClienteDrop, setShowClienteDrop] = useState(false)
  const clientesFiltrados = clienteQuery.length >= 1
    ? clientes.filter((c) => c.nombre.toLowerCase().includes(clienteQuery.toLowerCase())).slice(0, 8)
    : []
  const clienteSeleccionado = clientes.find((c) => c.id === parseInt(clienteId))

  // Dirección del cliente
  const todasDirecciones: { etiqueta: string; direccion: string }[] = []
  if (clienteSeleccionado) {
    if (clienteSeleccionado.direccion) {
      todasDirecciones.push({ etiqueta: 'Principal', direccion: clienteSeleccionado.direccion })
    }
    if (Array.isArray(clienteSeleccionado.direcciones)) {
      clienteSeleccionado.direcciones.forEach((d) => {
        if (d.direccion && !todasDirecciones.find((x) => x.direccion === d.direccion)) {
          todasDirecciones.push({ etiqueta: d.etiqueta, direccion: d.direccion })
        }
      })
    }
  }

  const [direccionIdx, setDireccionIdx] = useState(0)

  // ── Campos generales ─────────────────────────────────────────
  const [fecha, setFecha] = useState(
    reporte?.fecha_ingreso ?? new Date().toISOString().split('T')[0]
  )
  const [tecnicoId, setTecnicoId] = useState(reporte?.tecnico_id ?? '')
  const [estado, setEstado] = useState(reporte?.estado ?? 'abierto')

  // ── Tipo de servicio ─────────────────────────────────────────
  const [tipos, setTipos] = useState<string[]>(reporte?.tipo_servicio ?? [])
  function toggleTipo(t: string) {
    setTipos((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
  }

  // ── Diagnóstico ──────────────────────────────────────────────
  const [fallaReportada, setFallaReportada] = useState(reporte?.falla_reportada ?? '')
  const [diagnostico,    setDiagnostico]    = useState(reporte?.diagnostico ?? '')

  // ── Trabajos realizados (cada uno es un textarea) ─────────────
  const [trabajos, setTrabajos] = useState<string[]>(
    reporte?.trabajos_realizados?.length
      ? reporte.trabajos_realizados
      : reporte?.trabajo_realizado
        ? [reporte.trabajo_realizado]
        : ['']
  )

  // ── Materiales (Cantidad | Descripción | Costo total) ─────────
  const [materiales, setMateriales] = useState<MaterialForm[]>(
    reporte?.items?.length
      ? reporte.items.map((i) => ({
          descripcion: i.descripcion,
          cantidad:    i.cantidad,
          costo:       i.subtotal,
        }))
      : [{ descripcion: '', cantidad: 1, costo: 0 }]
  )

  // ── Evidencias (fijas: antes / después) ──────────────────────
  const [evAntes,   setEvAntes]   = useState<EvidenciaForm>({
    urls:       reporte?.evidencias?.find((e) => e.tipo === 'antes')?.urls ?? [],
    descripcion: reporte?.evidencias?.find((e) => e.tipo === 'antes')?.descripcion ?? '',
    uploading:  false,
  })
  const [evDespues, setEvDespues] = useState<EvidenciaForm>({
    urls:       reporte?.evidencias?.find((e) => e.tipo === 'despues')?.urls ?? [],
    descripcion: reporte?.evidencias?.find((e) => e.tipo === 'despues')?.descripcion ?? '',
    uploading:  false,
  })

  const fileBeforeRef  = useRef<HTMLInputElement>(null)
  const fileAfterRef   = useRef<HTMLInputElement>(null)

  // ── Estado y observaciones ───────────────────────────────────
  const [observaciones, setObservaciones] = useState(reporte?.observaciones ?? '')

  // ── Submit ───────────────────────────────────────────────────
  const [costoTotal, setCostoTotal] = useState(
    reporte?.total ? Number(reporte.total) : 0
  )

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // ── Eliminar foto de Storage y del estado ────────────────────
  async function eliminarFoto(
    url: string,
    setEv: React.Dispatch<React.SetStateAction<EvidenciaForm>>,
    idx: number,
  ) {
    // Optimistic: quitar del estado de inmediato
    setEv((e) => ({ ...e, urls: e.urls.filter((_, i) => i !== idx) }))
    // Borrar del bucket (si es URL externa como Google Drive, el endpoint devuelve ok sin hacer nada)
    await fetch('/api/evidencias', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  }

  // ── Upload fotos ─────────────────────────────────────────────
  async function uploadFotos(
    files: File[],
    tipo: 'antes' | 'despues',
    setEv: React.Dispatch<React.SetStateAction<EvidenciaForm>>,
  ) {
    setEv((e) => ({ ...e, uploading: true }))
    for (const file of files) {
      try {
        const reader = new FileReader()
        const base64: string = await new Promise((res, rej) => {
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        const resp = await fetch('/api/evidencias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: base64, mimeType: file.type, nombre: file.name, sesion, tipo }),
        })
        const json = await resp.json()
        if (!resp.ok) throw new Error(json.error)
        setEv((e) => ({ ...e, urls: [...e.urls, json.url] }))
      } catch (err) {
        alert('Error al subir imagen: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
    setEv((e) => ({ ...e, uploading: false }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!clienteId)            return setError('Selecciona un cliente')
    if (!tecnicoId)            return setError('Selecciona un técnico')
    if (!fallaReportada.trim()) return setError('La falla reportada es requerida')

    setLoading(true)
    setError('')

    const direccionServicio = todasDirecciones[direccionIdx]?.direccion ?? ''

    const evidencias = [
      ...(evAntes.urls.length   > 0 ? [{ tipo: 'antes',   descripcion: evAntes.descripcion,   urls: evAntes.urls }]   : []),
      ...(evDespues.urls.length > 0 ? [{ tipo: 'despues', descripcion: evDespues.descripcion, urls: evDespues.urls }] : []),
    ]

    const items = materiales
      .filter((m) => m.descripcion.trim())
      .map((m) => ({
        descripcion:    m.descripcion,
        cantidad:       m.cantidad,
        precio_unitario: m.cantidad > 0 ? m.costo / m.cantidad : m.costo,
        subtotal:       m.costo,
      }))

    const payload = {
      cliente_id:          parseInt(clienteId),
      fecha_ingreso:       fecha,
      tecnico_id:          tecnicoId,
      equipo:              'Servicio técnico',
      direccion_servicio:  direccionServicio,
      tipo_servicio:       tipos,
      falla_reportada:     fallaReportada,
      diagnostico,
      trabajos_realizados: trabajos.filter((t) => t.trim()),
      observaciones,
      estado,
      evidencias,
      subtotal: costoTotal,
      total:    costoTotal,
      items,
    }

    const res = await fetch(
      esNuevo ? '/api/reportes' : `/api/reportes/${reporte.id}`,
      { method: esNuevo ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    )
    const json = await res.json()
    setLoading(false)
    if (!res.ok) return setError(json.error ?? 'Error al guardar')
    onGuardado(json.data)
  }

  const anyUploading = evAntes.uploading || evDespues.uploading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-t-2xl border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {esNuevo ? 'Nuevo Reporte de Servicio' : `Editar ${reporte.folio}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form id="reporte-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 space-y-3">

          {/* ── 1. Datos Generales ── */}
          <div className={sectionCls}>
            <p className={sectionTitleCls}>① Datos Generales</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Fecha */}
              <div>
                <label className={labelCls}>Fecha <span className="text-red-500">*</span></label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
              </div>

              {/* Cliente search */}
              <div className="relative">
                <label className={labelCls}>Cliente <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={clienteQuery}
                  onChange={(e) => { setClienteQuery(e.target.value); setClienteId(''); setShowClienteDrop(true) }}
                  onFocus={() => setShowClienteDrop(true)}
                  onBlur={() => setTimeout(() => setShowClienteDrop(false), 150)}
                  placeholder="Escribe para buscar cliente..."
                  className={inputCls}
                />
                {showClienteDrop && clientesFiltrados.length > 0 && (
                  <div className="absolute z-30 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {clientesFiltrados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-800"
                        onMouseDown={() => {
                          setClienteId(String(c.id))
                          setClienteQuery(c.nombre)
                          setShowClienteDrop(false)
                          setDireccionIdx(0)
                        }}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dirección del cliente */}
              <div>
                <label className={labelCls}>Dirección del cliente</label>
                <select
                  value={direccionIdx}
                  onChange={(e) => setDireccionIdx(parseInt(e.target.value))}
                  className={inputCls}
                  disabled={!clienteId || todasDirecciones.length === 0}
                >
                  {todasDirecciones.length === 0
                    ? <option value={0}>Seleccione una dirección</option>
                    : todasDirecciones.map((d, i) => (
                        <option key={i} value={i}>{d.etiqueta} — {d.direccion}</option>
                      ))
                  }
                </select>
              </div>

              {/* Técnico */}
              <div>
                <label className={labelCls}>Técnico que atendió <span className="text-red-500">*</span></label>
                <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} className={inputCls}>
                  <option value="">Seleccione un técnico</option>
                  {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

            </div>
          </div>

          {/* ── 2. Tipo de Servicio ── */}
          <div className={sectionCls}>
            <p className={sectionTitleCls}>② Tipo de Servicio</p>
            <div className="flex flex-wrap gap-4">
              {TIPOS_SERVICIO.map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tipos.includes(t)}
                    onChange={() => toggleTipo(t)}
                    className="rounded border-gray-300 text-blue-600 w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── 3. Diagnóstico y Trabajo Realizado ── */}
          <div className={sectionCls}>
            <p className={sectionTitleCls}>③ Diagnóstico y Trabajo Realizado</p>
            <div>
              <label className={labelCls}>Falla reportada por el cliente <span className="text-red-500">*</span></label>
              <textarea
                value={fallaReportada}
                onChange={(e) => setFallaReportada(e.target.value)}
                rows={3}
                placeholder="Descripción de la falla..."
                className={inputCls + ' resize-none'}
              />
            </div>
            <div>
              <label className={labelCls}>Diagnóstico del técnico</label>
              <textarea
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                rows={3}
                placeholder="Diagnóstico realizado..."
                className={inputCls + ' resize-none'}
              />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Trabajos realizados</label>
              {trabajos.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <textarea
                    value={t}
                    onChange={(e) => setTrabajos((prev) => { const a = [...prev]; a[i] = e.target.value; return a })}
                    rows={2}
                    placeholder="Descripción del trabajo..."
                    className={inputCls + ' resize-none flex-1'}
                  />
                  {trabajos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTrabajos((prev) => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 shrink-0 self-start mt-1"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTrabajos((prev) => [...prev, ''])}
                className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus size={14} /> Agregar trabajo
              </button>
            </div>
          </div>

          {/* ── 4. Materiales y Repuestos ── */}
          <div className={sectionCls}>
            <p className={sectionTitleCls}>④ Materiales y Repuestos</p>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase px-1">
                <div className="col-span-2">Cantidad</div>
                <div className="col-span-7">Descripción</div>
                <div className="col-span-2 text-right">Costo</div>
                <div />
              </div>
              {materiales.map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <input type="number" min="1" step="1" value={m.cantidad}
                      onChange={(e) => setMateriales((prev) => { const a = [...prev]; a[i] = { ...a[i], cantidad: parseInt(e.target.value) || 1 }; return a })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-7">
                    <input type="text" value={m.descripcion}
                      onChange={(e) => setMateriales((prev) => { const a = [...prev]; a[i] = { ...a[i], descripcion: e.target.value }; return a })}
                      placeholder="Descripción"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" value={m.costo}
                      onChange={(e) => setMateriales((prev) => { const a = [...prev]; a[i] = { ...a[i], costo: parseFloat(e.target.value) || 0 }; return a })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="flex justify-center">
                    {materiales.length > 1 && (
                      <button type="button" onClick={() => setMateriales((prev) => prev.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setMateriales((prev) => [...prev, { descripcion: '', cantidad: 1, costo: 0 }])}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus size={14} /> Agregar material
              </button>
            </div>
          </div>

          {/* ── 5. Evidencias ── */}
          <div className={sectionCls}>
            <p className={sectionTitleCls}>⑤ Evidencias</p>
            <div className="grid grid-cols-2 gap-4">
              {/* Antes */}
              <div className="space-y-2">
                <label className={labelCls}>5.1 Evidencia Antes</label>
                <input ref={fileBeforeRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={async (e) => { await uploadFotos(Array.from(e.target.files ?? []), 'antes', setEvAntes); e.target.value = '' }} />
                <button type="button" onClick={() => fileBeforeRef.current?.click()}
                  disabled={evAntes.uploading}
                  className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg text-sm text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50">
                  <Upload size={14} /> {evAntes.uploading ? 'Subiendo...' : 'Elegir archivos'}
                </button>
                {evAntes.urls.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {evAntes.urls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="antes" className="w-16 h-12 object-cover rounded border border-gray-200" />
                        <button type="button" onClick={() => eliminarFoto(url, setEvAntes, idx)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs hidden group-hover:flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-gray-400"><ImageOff size={12} /> Sin fotos</div>
                )}
                <textarea value={evAntes.descripcion} onChange={(e) => setEvAntes((ev) => ({ ...ev, descripcion: e.target.value }))}
                  rows={2} placeholder="Descripción de las imágenes..." className={inputCls + ' resize-none text-xs'} />
              </div>

              {/* Después */}
              <div className="space-y-2">
                <label className={labelCls}>5.2 Evidencia Después</label>
                <input ref={fileAfterRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={async (e) => { await uploadFotos(Array.from(e.target.files ?? []), 'despues', setEvDespues); e.target.value = '' }} />
                <button type="button" onClick={() => fileAfterRef.current?.click()}
                  disabled={evDespues.uploading}
                  className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg text-sm text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50">
                  <Upload size={14} /> {evDespues.uploading ? 'Subiendo...' : 'Elegir archivos'}
                </button>
                {evDespues.urls.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {evDespues.urls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="después" className="w-16 h-12 object-cover rounded border border-gray-200" />
                        <button type="button" onClick={() => eliminarFoto(url, setEvDespues, idx)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs hidden group-hover:flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-gray-400"><ImageOff size={12} /> Sin fotos</div>
                )}
                <textarea value={evDespues.descripcion} onChange={(e) => setEvDespues((ev) => ({ ...ev, descripcion: e.target.value }))}
                  rows={2} placeholder="Descripción de las imágenes..." className={inputCls + ' resize-none text-xs'} />
              </div>
            </div>
          </div>

          {/* ── 6. Estado y Observaciones ── */}
          <div className={sectionCls}>
            <p className={sectionTitleCls}>⑥ Estado del Servicio y Observaciones</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Estado del Servicio</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className={inputCls}>
                  <option value="abierto">Abierto</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="completado">Completado</option>
                  <option value="entregado">Entregado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Observaciones</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                  rows={3} placeholder="Observaciones adicionales..." className={inputCls + ' resize-none'} />
              </div>
            </div>
          </div>

          {/* ── 7. Costo del Servicio ── */}
          <div className={sectionCls}>
            <p className={sectionTitleCls}>⑦ Costo del Servicio</p>
            <div className="max-w-[200px]">
              <label className={labelCls}>Costo Total</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costoTotal}
                  onChange={(e) => setCostoTotal(parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-white rounded-b-2xl border-t border-gray-200 shrink-0">
          <button type="button" onClick={onClose}
            className="px-5 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            form="reporte-form"
            disabled={loading || anyUploading}
            className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors font-medium"
          >
            {loading ? 'Guardando...' : '💾 Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

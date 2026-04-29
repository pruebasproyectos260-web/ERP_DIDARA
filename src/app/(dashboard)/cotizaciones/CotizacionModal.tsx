'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Plus, Trash2, Search, Package } from 'lucide-react'
import type { Cotizacion, ItemCotizacion, Contacto, EstadoCotizacion } from '@/types'

// ─── Types exported for use in CotizacionesClient ────────────────────────────
export type ClienteParaCot = {
  id: number
  nombre: string
  rfc?: string | null
  uso_cfdi?: string | null
  regimen_fiscal?: string | null
  direcciones: Array<{ etiqueta: string; direccion: string; contactos: Contacto[] }>
  contactos: Contacto[]
}

export type ProductoParaCot = {
  id: number
  nombre: string
  precio_venta: number
  precio_compra_neto: number
  unidad: string
  imagen_url?: string | null
}

// ─── Internal item type (includes display-only fields) ───────────────────────
type ItemForm = Omit<ItemCotizacion, 'id'> & {
  precio_compra: number
  cantidad_recuperada: number
  imagen_url?: string | null
}

interface Props {
  cotizacion: Cotizacion | null
  clientes: ClienteParaCot[]
  productos: ProductoParaCot[]
  ivaDefault: number
  onClose: () => void
  onGuardada: (cotizacion: Cotizacion) => void
}

const ESTADOS: EstadoCotizacion[] = [
  'borrador', 'pendiente', 'enviada', 'aprobada', 'aceptada',
  'rechazada', 'facturada', 'cancelada', 'pagada',
]

function itemVacio(): ItemForm {
  return { tipo: 'producto', descripcion: '', cantidad: 1, precio_unitario: 0, precio_compra: 0, cantidad_recuperada: 0, descuento: 0, subtotal: 0 }
}

function calcSubtotal(item: ItemForm): number {
  return item.cantidad * item.precio_unitario * (1 - item.descuento / 100)
}

function calcGananciaItem(item: ItemForm): number {
  const revenue = item.cantidad * item.precio_unitario * (1 - item.descuento / 100)
  const costoUnit = item.tipo === 'servicio' ? 0 : item.precio_compra
  const cantPagada = Math.max(0, item.cantidad - (item.cantidad_recuperada ?? 0))
  return revenue - costoUnit * cantPagada
}

// ─── Product autocomplete dropdown ───────────────────────────────────────────
function ProductSearch({
  productos,
  initialValue,
  onSelect,
}: {
  productos: ProductoParaCot[]
  initialValue: string
  onSelect: (p: ProductoParaCot) => void
}) {
  const [query, setQuery] = useState(initialValue)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.length >= 1
    ? productos.filter((p) => p.nombre.toLowerCase().includes(query.toLowerCase())).slice(0, 14)
    : productos.slice(0, 14)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar producto..."
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => { onSelect(p); setQuery(p.nombre); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 text-left transition-colors border-b border-gray-50 last:border-0"
            >
              {p.imagen_url ? (
                <img
                  src={p.imagen_url}
                  alt=""
                  className="w-9 h-9 object-contain rounded border border-gray-100 bg-gray-50 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-9 h-9 bg-gray-100 rounded border border-gray-100 flex items-center justify-center shrink-0">
                  <Package size={13} className="text-gray-300" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-900 leading-snug line-clamp-2">{p.nombre}</p>
                <p className="text-[10px] text-gray-400">${p.precio_venta.toFixed(2)} · {p.unidad}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main modal ──────────────────────────────────────────────────────────────
export default function CotizacionModal({
  cotizacion, clientes, productos, ivaDefault, onClose, onGuardada,
}: Props) {
  const esNuevo = !cotizacion

  // Restore initial client object when editing
  const clienteInicial = cotizacion
    ? clientes.find((c) => c.id === cotizacion.cliente_id) ?? null
    : null

  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteParaCot | null>(clienteInicial)
  const [clienteQuery, setClienteQuery] = useState(clienteInicial?.nombre ?? '')
  const [clienteOpen, setClienteOpen] = useState(false)
  const clienteRef = useRef<HTMLDivElement>(null)

  const [rfc, setRfc] = useState(clienteInicial?.rfc ?? '')
  const [cfdiUso, setCfdiUso] = useState(clienteInicial?.uso_cfdi ?? '')
  const [direccionIdx, setDireccionIdx] = useState(0)
  const [contactosSeleccionados, setContactosSeleccionados] = useState<Contacto[]>(
    cotizacion?.contactos_cotizacion ?? []
  )

  const [fecha, setFecha] = useState(cotizacion?.fecha ?? new Date().toISOString().split('T')[0])
  const [estado, setEstado] = useState<EstadoCotizacion>(cotizacion?.estado ?? 'borrador')
  const [aplicaIva, setAplicaIva] = useState(cotizacion?.aplica_iva ?? false)
  const [ivaPorcentaje, setIvaPorcentaje] = useState(cotizacion?.iva_porcentaje ?? ivaDefault)
  const [notas, setNotas] = useState(cotizacion?.notas ?? '')

  const [items, setItems] = useState<ItemForm[]>(
    cotizacion?.items?.length
      ? cotizacion.items.map((it) => ({
          tipo: it.tipo,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          precio_compra: it.precio_compra ?? 0,
          cantidad_recuperada: it.cantidad_recuperada ?? 0,
          descuento: it.descuento,
          subtotal: it.subtotal,
          producto_id: it.producto_id,
          imagen_url: it.producto_id
            ? productos.find((p) => p.id === it.producto_id)?.imagen_url
            : undefined,
        }))
      : [itemVacio()]
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Derived values ──────────────────────────────────────────────────────────
  const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0)
  const ivaMonto = aplicaIva ? subtotal * (ivaPorcentaje / 100) : 0
  const total = subtotal + ivaMonto
  const gananciaTotal = items.reduce((acc, it) => acc + calcGananciaItem(it), 0)

  const todasDirecciones = clienteSeleccionado?.direcciones ?? []

  // All unique contacts from client (top-level + from each dirección)
  const todosContactos: Contacto[] = clienteSeleccionado
    ? [
        ...clienteSeleccionado.contactos,
        ...clienteSeleccionado.direcciones.flatMap((d) => d.contactos ?? []),
      ].filter((c, i, arr) =>
        arr.findIndex((x) => x.nombre === c.nombre && (x.email ?? '') === (c.email ?? '')) === i
      )
    : []

  const clientesFiltrados = clienteQuery.length >= 1
    ? clientes.filter((c) => c.nombre.toLowerCase().includes(clienteQuery.toLowerCase())).slice(0, 10)
    : clientes.slice(0, 10)

  // Close client dropdown on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) setClienteOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleSelectCliente(c: ClienteParaCot) {
    setClienteSeleccionado(c)
    setClienteQuery(c.nombre)
    setRfc(c.rfc ?? '')
    setCfdiUso(c.uso_cfdi ?? '')
    setDireccionIdx(0)
    setContactosSeleccionados([])
    setClienteOpen(false)
  }

  function setItem(i: number, field: keyof ItemForm, value: string | number | null) {
    setItems((prev) => {
      const arr = [...prev]
      const updated = { ...arr[i], [field]: value }
      if (field === 'tipo' && value === 'servicio') {
        updated.precio_compra = 0
        updated.cantidad_recuperada = 0
        updated.imagen_url = undefined
      }
      updated.subtotal = calcSubtotal(updated)
      arr[i] = updated
      return arr
    })
  }

  function handleSelectProducto(i: number, prod: ProductoParaCot) {
    setItems((prev) => {
      const arr = [...prev]
      const updated = {
        ...arr[i],
        descripcion: prod.nombre,
        precio_unitario: prod.precio_venta,
        precio_compra: prod.precio_compra_neto,
        producto_id: prod.id,
        imagen_url: prod.imagen_url,
      }
      updated.subtotal = calcSubtotal(updated)
      arr[i] = updated
      return arr
    })
  }

  function toggleContacto(c: Contacto) {
    setContactosSeleccionados((prev) => {
      const idx = prev.findIndex((x) => x.nombre === c.nombre && x.email === c.email)
      if (idx >= 0) return prev.filter((_, j) => j !== idx)
      return [...prev, c]
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteSeleccionado) return setError('Selecciona un cliente')
    if (items.some((it) => !it.descripcion.trim())) return setError('Todos los items deben tener descripción')

    setLoading(true)
    setError('')

    const payload = {
      cliente_id: clienteSeleccionado.id,
      fecha,
      estado,
      aplica_iva: aplicaIva,
      iva_porcentaje: ivaPorcentaje,
      subtotal,
      iva_monto: ivaMonto,
      total,
      ganancia_total: gananciaTotal,
      notas: notas || null,
      direccion_entrega: todasDirecciones[direccionIdx]?.direccion ?? null,
      contactos_cotizacion: contactosSeleccionados,
      items: items.map(({ tipo, descripcion, cantidad, precio_unitario, precio_compra, cantidad_recuperada, descuento, subtotal: st, producto_id, imagen_url }) => ({
        tipo,
        descripcion,
        cantidad,
        precio_unitario,
        precio_compra: tipo === 'servicio' ? 0 : precio_compra,
        cantidad_recuperada: tipo === 'equipo_recuperado' ? cantidad_recuperada : 0,
        descuento,
        subtotal: st,
        producto_id: producto_id ?? null,
        imagen_url: imagen_url ?? null,
      })),
    }

    const res = await fetch(
      esNuevo ? '/api/cotizaciones' : `/api/cotizaciones/${cotizacion.id}`,
      { method: esNuevo ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    )
    const json = await res.json()
    setLoading(false)
    if (!res.ok) return setError(json.error ?? 'Error al guardar')
    onGuardada(json.data)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {esNuevo ? 'Nueva Cotización' : `Editar ${cotizacion.folio}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Fecha + Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoCotizacion)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ESTADOS.map((e) => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Cliente search */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <div ref={clienteRef} className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={clienteQuery}
                onChange={(e) => { setClienteQuery(e.target.value); setClienteOpen(true) }}
                onFocus={() => setClienteOpen(true)}
                placeholder="Busca un cliente..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {clienteOpen && clientesFiltrados.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                  {clientesFiltrados.map((c) => (
                    <button key={c.id} type="button" onMouseDown={() => handleSelectCliente(c)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0">
                      <span className="font-medium">{c.nombre}</span>
                      {c.rfc && <span className="text-xs text-gray-400 ml-2 font-mono">{c.rfc}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Client details (auto-filled, read-only) */}
          {clienteSeleccionado && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Razón Social</label>
                  <input type="text" value={clienteSeleccionado.nombre} readOnly
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">RFC</label>
                  <input type="text" value={rfc} readOnly
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">CFDI</label>
                  <input type="text" value={cfdiUso} readOnly
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600" />
                </div>
              </div>

              {/* Dirección de Entrega */}
              {todasDirecciones.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Dirección de Entrega</h4>
                  <div className="space-y-2">
                    {todasDirecciones.map((dir, idx) => (
                      <label key={idx}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          direccionIdx === idx ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}>
                        <input type="radio" name="dir_entrega" checked={direccionIdx === idx}
                          onChange={() => setDireccionIdx(idx)} className="mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{dir.etiqueta}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{dir.direccion}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Contactos para esta Cotización */}
              {todosContactos.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Contactos para esta Cotización</h4>
                  <p className="text-xs text-gray-400 mb-2">Selecciona los contactos que aparecerán en el documento.</p>
                  <div className="space-y-1.5">
                    {todosContactos.map((c, idx) => {
                      const checked = contactosSeleccionados.some(
                        (x) => x.nombre === c.nombre && x.email === c.email
                      )
                      return (
                        <label key={idx}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            checked ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleContacto(c)} className="shrink-0" />
                          <span className="text-xs text-gray-700">
                            <span className="font-semibold">{c.nombre}</span>
                            {c.puesto && ` (${c.puesto})`}
                            {c.email && ` — ${c.email}`}
                            {c.telefono && ` | ${c.telefono}`}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* IVA */}
          <div className="flex items-center gap-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={aplicaIva} onChange={(e) => setAplicaIva(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 w-4 h-4" />
              <span className="text-sm font-medium text-gray-700">Aplicar IVA (para facturación)</span>
            </label>
            {aplicaIva && (
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="100" step="0.01" value={ivaPorcentaje}
                  onChange={(e) => setIvaPorcentaje(parseFloat(e.target.value) || 0)}
                  className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-sm text-gray-600">%</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Items</h3>
            <div className="space-y-4">
              {items.map((item, i) => (
                <div key={i}
                  className={`border rounded-xl p-4 relative ${
                    item.tipo === 'equipo_recuperado' ? 'border-orange-200 bg-orange-50'
                    : item.tipo === 'servicio' ? 'border-sky-200 bg-sky-50'
                    : 'border-gray-200 bg-gray-50'
                  }`}>
                  {/* Item header */}
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Item #{i + 1}</h5>
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors border border-red-200">
                        <Trash2 size={11} /> Eliminar Item
                      </button>
                    )}
                  </div>

                  {/* Tipo */}
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo</label>
                    <select value={item.tipo} onChange={(e) => setItem(i, 'tipo', e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="producto">Producto</option>
                      <option value="servicio">Servicio</option>
                      <option value="equipo_recuperado">Equipo Recuperado</option>
                    </select>
                  </div>

                  {/* Product image preview */}
                  {item.imagen_url && (
                    <div className="flex justify-center mb-3">
                      <img
                        src={item.imagen_url}
                        alt={item.descripcion}
                        className="max-w-[90px] max-h-[90px] object-contain rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                  )}

                  {/* Product / Service input */}
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      {item.tipo === 'servicio' ? 'Descripción del Servicio' : 'Producto / Servicio'}
                    </label>
                    {item.tipo === 'servicio' ? (
                      <input type="text" value={item.descripcion}
                        onChange={(e) => setItem(i, 'descripcion', e.target.value)}
                        placeholder="Describe el servicio..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    ) : (
                      <ProductSearch
                        key={`${i}-${item.producto_id ?? 'none'}`}
                        productos={productos}
                        initialValue={item.descripcion}
                        onSelect={(prod) => handleSelectProducto(i, prod)}
                      />
                    )}
                  </div>

                  {/* Descripción override for products */}
                  {item.tipo !== 'servicio' && item.descripcion && (
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Descripción</label>
                      <textarea value={item.descripcion} onChange={(e) => setItem(i, 'descripcion', e.target.value)}
                        rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none" />
                    </div>
                  )}

                  {/* Numeric fields */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cantidad</label>
                      <input type="number" min="1" step="1" value={item.cantidad}
                        onChange={(e) => setItem(i, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Precio Unitario</label>
                      <input type="number" min="0" step="0.01" value={item.precio_unitario}
                        onChange={(e) => setItem(i, 'precio_unitario', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">P. Compra</label>
                      <input type="number" min="0" step="0.01"
                        value={item.tipo === 'servicio' ? 0 : item.precio_compra}
                        onChange={(e) => setItem(i, 'precio_compra', parseFloat(e.target.value) || 0)}
                        disabled={item.tipo === 'servicio'}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Descuento (%) Item</label>
                      <input type="number" min="0" max="100" step="0.01" value={item.descuento}
                        onChange={(e) => setItem(i, 'descuento', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                  </div>

                  {/* Recuperados — only for equipo_recuperado */}
                  {item.tipo === 'equipo_recuperado' && (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">
                        Unidades Recuperadas (costo $0)
                      </label>
                      <input type="number" min="0" max={item.cantidad} step="1" value={item.cantidad_recuperada}
                        onChange={(e) => setItem(i, 'cantidad_recuperada', parseFloat(e.target.value) || 0)}
                        className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50" />
                      <p className="text-[10px] text-orange-600 mt-0.5">
                        Se compran {Math.max(0, item.cantidad - item.cantidad_recuperada)} u · {item.cantidad_recuperada} recuperadas (sin costo)
                      </p>
                    </div>
                  )}

                  {/* Subtotal + Ganancia (readonly) */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subtotal Item</label>
                      <input type="text" value={`$${item.subtotal.toFixed(2)}`} readOnly
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 font-semibold" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ganancia Item</label>
                      <input type="text" value={`$${calcGananciaItem(item).toFixed(2)}`} readOnly
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-green-700 font-semibold" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add item button */}
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, itemVacio()])}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Plus size={15} /> Agregar Item
            </button>
          </div>

          {/* Totales */}
          <div className="flex justify-end">
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 space-y-1.5 w-72">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
              </div>
              {aplicaIva && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>IVA ({ivaPorcentaje}%)</span><span>${ivaMonto.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-1.5 mt-1">
                <span>Total</span><span>${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-green-700 border-t border-gray-100 pt-1.5">
                <span>Ganancia estimada</span><span>${gananciaTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit as never} disabled={loading}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

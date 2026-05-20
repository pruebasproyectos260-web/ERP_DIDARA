'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Upload, Image as ImageIcon } from 'lucide-react'
import type { Producto } from '@/types'

const CATEGORIAS_OPCIONES = [
  'CCTV', 'Redes', 'Energía', 'Telefonía', 'Cómputo',
  'Impresoras', 'Consumibles', 'Instalación', 'Mantenimiento',
  'Seguridad', 'Automatización', 'Audio y Video', 'Acceso',
]

interface Props {
  producto: Producto | null
  ivaDefault: number
  onClose: () => void
  onGuardado: (producto: Producto) => void
}

export default function ProductoModal({ producto, ivaDefault, onClose, onGuardado }: Props) {
  const esNuevo = !producto
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nombre: producto?.nombre ?? '',
    descripcion: producto?.descripcion ?? '',
    unidad: producto?.unidad ?? 'pza',
    precio_venta: producto?.precio_venta?.toString() ?? '0',
    precio_venta_incluye_iva: producto?.precio_venta_incluye_iva ?? false,
    iva_venta: producto?.iva_venta?.toString() ?? ivaDefault.toString(),
    precio_compra_neto: producto?.precio_compra_neto?.toString() ?? '0',
    precio_compra_incluye_iva: producto?.precio_compra_incluye_iva ?? false,
    iva_compra: producto?.iva_compra?.toString() ?? ivaDefault.toString(),
    stock: producto?.stock?.toString() ?? '0',
    stock_minimo: producto?.stock_minimo?.toString() ?? '0',
    clave_sat_producto: producto?.clave_sat_producto ?? '',
    clave_sat_unidad: producto?.clave_sat_unidad ?? '',
  })

  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>(() => {
    const raw = producto?.categorias ?? producto?.categoria ?? ''
    return raw ? raw.split(';').map(c => c.trim()).filter(Boolean) : []
  })

  // Imagen
  const [imagenActual, setImagenActual] = useState(producto?.imagen_url ?? '')
  const [imagenFile, setImagenFile] = useState<File | null>(null)
  const [imagenPreview, setImagenPreview] = useState(producto?.imagen_url ?? '')
  const [subiendoImagen, setSubiendoImagen] = useState(false)

  const [precioVentaConIva, setPrecioVentaConIva] = useState(0)
  const [precioCompraConIva, setPrecioCompraConIva] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const neto = parseFloat(form.precio_venta) || 0
    const iva = parseFloat(form.iva_venta) || 0
    setPrecioVentaConIva(form.precio_venta_incluye_iva ? neto : neto * (1 + iva / 100))
  }, [form.precio_venta, form.iva_venta, form.precio_venta_incluye_iva])

  useEffect(() => {
    const neto = parseFloat(form.precio_compra_neto) || 0
    const iva = parseFloat(form.iva_compra) || 0
    setPrecioCompraConIva(form.precio_compra_incluye_iva ? neto : neto * (1 + iva / 100))
  }, [form.precio_compra_neto, form.iva_compra, form.precio_compra_incluye_iva])

  function setField(field: keyof typeof form, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleCategoria(cat: string) {
    setCategoriasSeleccionadas(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  function quitarImagen() {
    setImagenFile(null)
    setImagenPreview('')
    setImagenActual('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function subirImagen(file: File): Promise<string> {
    setSubiendoImagen(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/inventario/upload', { method: 'POST', body: fd })
    const json = await res.json()
    setSubiendoImagen(false)
    if (!res.ok) throw new Error(json.error ?? 'Error al subir imagen')
    return json.url as string
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return setError('El nombre es requerido')
    setLoading(true)
    setError('')

    try {
      let imagenUrl = imagenActual

      if (imagenFile) {
        imagenUrl = await subirImagen(imagenFile)
      }

      const categoriasStr = categoriasSeleccionadas.join(';')
      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        categoria: categoriasSeleccionadas[0] ?? null,
        categorias: categoriasStr || null,
        unidad: form.unidad,
        precio_venta: parseFloat(form.precio_venta) || 0,
        precio_venta_incluye_iva: form.precio_venta_incluye_iva,
        iva_venta: parseFloat(form.iva_venta) || 0,
        precio_compra_neto: parseFloat(form.precio_compra_neto) || 0,
        precio_compra_incluye_iva: form.precio_compra_incluye_iva,
        iva_compra: parseFloat(form.iva_compra) || 0,
        stock: parseFloat(form.stock) || 0,
        stock_minimo: parseFloat(form.stock_minimo) || 0,
        clave_sat_producto: form.clave_sat_producto || null,
        clave_sat_unidad: form.clave_sat_unidad || null,
        imagen_url: imagenUrl || null,
      }

      const res = await fetch(
        esNuevo ? '/api/inventario' : `/api/inventario/${producto.id}`,
        {
          method: esNuevo ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const json = await res.json()
      if (!res.ok) return setError(json.error ?? 'Error al guardar')
      onGuardado(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {esNuevo ? 'Nuevo producto' : 'Editar producto'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setField('nombre', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Categorías */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categorías</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS_OPCIONES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategoria(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                    categoriasSeleccionadas.includes(cat)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {categoriasSeleccionadas.length > 0 && (
              <p className="text-[10px] text-gray-400 mt-1">
                Seleccionadas: {categoriasSeleccionadas.join(', ')}
              </p>
            )}
          </div>

          {/* Unidad + Descripción */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
              <select
                value={form.unidad}
                onChange={e => setField('unidad', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['pza', 'servicio', 'hora', 'mt', 'lt', 'kg', 'caja', 'par'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={e => setField('descripcion', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Precios */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Precios</h3>

            {/* Precio de venta */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Precio venta</label>
                <input type="number" min="0" step="0.01" value={form.precio_venta}
                  onChange={e => setField('precio_venta', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.precio_venta_incluye_iva}
                  onChange={e => setField('precio_venta_incluye_iva', e.target.checked)}
                  className="rounded border-gray-300 text-green-600"
                />
                <span className="text-xs text-gray-700">El precio de venta ya incluye IVA</span>
              </label>
              {!form.precio_venta_incluye_iva && (
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">IVA venta (%)</label>
                    <input type="number" min="0" max="100" step="0.01" value={form.iva_venta}
                      onChange={e => setField('iva_venta', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="bg-green-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-green-600 font-medium">Precio c/IVA</p>
                    <p className="text-sm font-bold text-green-800">${precioVentaConIva.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* Precio de compra */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Precio compra</label>
                <input type="number" min="0" step="0.01" value={form.precio_compra_neto}
                  onChange={e => setField('precio_compra_neto', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.precio_compra_incluye_iva}
                  onChange={e => setField('precio_compra_incluye_iva', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-xs text-gray-700">El precio de compra ya incluye IVA</span>
              </label>
              {!form.precio_compra_incluye_iva && (
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">IVA compra (%)</label>
                    <input type="number" min="0" max="100" step="0.01" value={form.iva_compra}
                      onChange={e => setField('iva_compra', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="bg-blue-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-blue-600 font-medium">Precio c/IVA</p>
                    <p className="text-sm font-bold text-blue-800">${precioCompraConIva.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SAT */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clave SAT Producto</label>
              <input type="text" value={form.clave_sat_producto}
                onChange={e => setField('clave_sat_producto', e.target.value)}
                placeholder="ej. 46171621"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clave SAT Unidad</label>
              <input type="text" value={form.clave_sat_unidad}
                onChange={e => setField('clave_sat_unidad', e.target.value)}
                placeholder="ej. H87"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Imagen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Imagen del producto</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
            {imagenPreview ? (
              <div className="relative w-32 h-32 group">
                <img
                  src={imagenPreview}
                  alt="Preview"
                  className="w-32 h-32 object-contain rounded-xl border border-gray-200 bg-gray-50"
                />
                <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-white text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded-lg"
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={quitarImagen}
                    className="text-white text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded-lg"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors gap-2"
              >
                <ImageIcon size={28} />
                <span className="text-sm font-medium">Seleccionar imagen</span>
                <span className="text-xs">JPG, PNG, WEBP — desde tu dispositivo</span>
              </button>
            )}
            {subiendoImagen && (
              <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                <Upload size={12} className="animate-bounce" /> Subiendo imagen...
              </p>
            )}
          </div>

          {/* Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock actual</label>
              <input type="number" min="0" step="0.001" value={form.stock}
                onChange={e => setField('stock', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
              <input type="number" min="0" step="0.001" value={form.stock_minimo}
                onChange={e => setField('stock_minimo', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || subiendoImagen}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
          >
            {loading ? 'Guardando...' : subiendoImagen ? 'Subiendo imagen...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

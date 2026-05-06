'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Producto } from '@/types'

interface Props {
  producto: Producto | null
  ivaDefault: number
  onClose: () => void
  onGuardado: (producto: Producto) => void
}

export default function ProductoModal({ producto, ivaDefault, onClose, onGuardado }: Props) {
  const esNuevo = !producto

  const [form, setForm] = useState({
    codigo: producto?.codigo ?? '',
    nombre: producto?.nombre ?? '',
    descripcion: producto?.descripcion ?? '',
    categoria: producto?.categoria ?? '',
    categorias: producto?.categorias ?? '',
    unidad: producto?.unidad ?? 'pza',
    precio_venta: producto?.precio_venta?.toString() ?? '0',
    precio_compra_neto: producto?.precio_compra_neto?.toString() ?? '0',
    precio_compra_incluye_iva: producto?.precio_compra_incluye_iva ?? false,
    iva_compra: producto?.iva_compra?.toString() ?? ivaDefault.toString(),
    stock: producto?.stock?.toString() ?? '0',
    stock_minimo: producto?.stock_minimo?.toString() ?? '0',
    clave_sat_producto: producto?.clave_sat_producto ?? '',
    clave_sat_unidad: producto?.clave_sat_unidad ?? '',
    imagen_url: producto?.imagen_url ?? '',
  })

  const [precioConIva, setPrecioConIva] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const neto = parseFloat(form.precio_compra_neto) || 0
    const iva = parseFloat(form.iva_compra) || 0
    if (form.precio_compra_incluye_iva) {
      setPrecioConIva(neto)
    } else {
      setPrecioConIva(neto * (1 + iva / 100))
    }
  }, [form.precio_compra_neto, form.iva_compra, form.precio_compra_incluye_iva])

  function setField(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return setError('El nombre es requerido')
    setLoading(true)
    setError('')

    const payload = {
      codigo: form.codigo || null,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      categoria: form.categoria || null,
      categorias: form.categorias || null,
      unidad: form.unidad,
      precio_venta: parseFloat(form.precio_venta) || 0,
      precio_compra_neto: parseFloat(form.precio_compra_neto) || 0,
      precio_compra_incluye_iva: form.precio_compra_incluye_iva,
      iva_compra: parseFloat(form.iva_compra) || 0,
      stock: parseFloat(form.stock) || 0,
      stock_minimo: parseFloat(form.stock_minimo) || 0,
      clave_sat_producto: form.clave_sat_producto || null,
      clave_sat_unidad: form.clave_sat_unidad || null,
      imagen_url: form.imagen_url || null,
    }

    try {
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
    } catch {
      setError('Error de red. Intenta de nuevo.')
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
              <input
                type="text"
                value={form.codigo}
                onChange={(e) => setField('codigo', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setField('nombre', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categorías</label>
              <input
                type="text"
                value={form.categorias}
                onChange={(e) => setField('categorias', e.target.value)}
                placeholder="CCTV;Redes;Energía"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Separa con punto y coma (;)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
              <select
                value={form.unidad}
                onChange={(e) => setField('unidad', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['pza', 'servicio', 'hora', 'mt', 'lt', 'kg', 'caja', 'par'].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setField('descripcion', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Precios */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Precios</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Precio venta (sin IVA)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_venta}
                  onChange={(e) => setField('precio_venta', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Precio compra</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_compra_neto}
                  onChange={(e) => setField('precio_compra_neto', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.precio_compra_incluye_iva}
                  onChange={(e) => setField('precio_compra_incluye_iva', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">El precio de compra ya incluye IVA</span>
              </label>
            </div>

            {!form.precio_compra_incluye_iva && (
              <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">IVA compra (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.iva_compra}
                    onChange={(e) => setField('iva_compra', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="bg-blue-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-blue-600 font-medium">Precio c/IVA</p>
                  <p className="text-sm font-bold text-blue-800">
                    ${precioConIva.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SAT + Imagen */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clave SAT Producto</label>
              <input
                type="text"
                value={form.clave_sat_producto}
                onChange={(e) => setField('clave_sat_producto', e.target.value)}
                placeholder="ej. 46171621"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clave SAT Unidad</label>
              <input
                type="text"
                value={form.clave_sat_unidad}
                onChange={(e) => setField('clave_sat_unidad', e.target.value)}
                placeholder="ej. H87"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">URL de imagen</label>
              <input
                type="text"
                value={form.imagen_url}
                onChange={(e) => setField('imagen_url', e.target.value)}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock actual</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.stock}
                onChange={(e) => setField('stock', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.stock_minimo}
                onChange={(e) => setField('stock_minimo', e.target.value)}
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
            onClick={handleSubmit as never}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

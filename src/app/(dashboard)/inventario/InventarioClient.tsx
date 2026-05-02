'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Pencil, Trash2, AlertCircle } from 'lucide-react'
import type { Producto } from '@/types'
import ProductoModal from './ProductoModal'

interface Props {
  productos: Producto[]
  ivaDefault: number
  nivel: number
}

function fmt$(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

export default function InventarioClient({ productos: inicial, ivaDefault, nivel }: Props) {
  const [productos, setProductos] = useState<Producto[]>(inicial)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [stockFiltro, setStockFiltro] = useState<'sinstock' | 'bajo' | null>(null)
  const [modal, setModal] = useState<{ open: boolean; producto: Producto | null }>({ open: false, producto: null })

  // Categorías únicas de todos los productos
  const categorias = useMemo(() => {
    const set = new Set<string>()
    productos.forEach((p) => {
      const cats = p.categorias ?? p.categoria ?? ''
      cats.split(';').map(c => c.trim()).filter(Boolean).forEach(c => set.add(c))
    })
    return Array.from(set).sort()
  }, [productos])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    return [...productos]
      .sort((a, b) => a.id - b.id)
      .filter((p) => {
        const matchQ = !q ||
          p.nombre.toLowerCase().includes(q) ||
          (p.descripcion?.toLowerCase().includes(q) ?? false) ||
          (p.codigo?.toLowerCase().includes(q) ?? false) ||
          (p.categorias?.toLowerCase().includes(q) ?? false)
        const cats = p.categorias ?? p.categoria ?? ''
        const matchCat = !categoriaFiltro || cats.split(';').map(c => c.trim()).includes(categoriaFiltro)
        const matchStock =
          !stockFiltro ||
          (stockFiltro === 'sinstock' && p.stock === 0) ||
          (stockFiltro === 'bajo' && p.stock > 0 && p.stock <= p.stock_minimo)
        return matchQ && matchCat && matchStock
      })
  }, [productos, busqueda, categoriaFiltro, stockFiltro])

  // Stats
  const totalProductos = productos.length
  const sinStock = productos.filter(p => p.stock === 0).length
  const stockBajo = productos.filter(p => p.stock > 0 && p.stock <= 5).length
  const valorInventario = productos.reduce((acc, p) => acc + p.precio_compra_neto * p.stock, 0)

  async function eliminar(id: number) {
    if (!confirm('¿Eliminar este producto?')) return
    await fetch(`/api/inventario/${id}`, { method: 'DELETE' })
    setProductos(prev => prev.filter(p => p.id !== id))
  }

  function onGuardado(producto: Producto) {
    setProductos(prev => {
      const idx = prev.findIndex(p => p.id === producto.id)
      if (idx >= 0) { const arr = [...prev]; arr[idx] = producto; return arr }
      return [producto, ...prev]
    })
    setModal({ open: false, producto: null })
  }

  const puedeEditar     = nivel <= 1
  const puedeEliminar   = nivel <= 1
  const puedeVerPrecios = nivel <= 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtrados.length} producto(s)</p>
        </div>
        {puedeEditar && (
          <button
            onClick={() => setModal({ open: true, producto: null })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Nuevo producto
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total productos</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{totalProductos}</p>
        </div>
        <button
          onClick={() => setStockFiltro(prev => prev === 'sinstock' ? null : 'sinstock')}
          className={`text-left rounded-xl p-4 border transition-colors ${stockFiltro === 'sinstock' ? 'bg-red-50 border-red-400' : 'bg-white border-gray-200 hover:border-red-300'}`}
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sin stock</p>
          <p className={`text-2xl font-bold mt-1 ${sinStock > 0 ? 'text-red-600' : 'text-gray-700'}`}>{sinStock}</p>
        </button>
        <button
          onClick={() => setStockFiltro(prev => prev === 'bajo' ? null : 'bajo')}
          className={`text-left rounded-xl p-4 border transition-colors ${stockFiltro === 'bajo' ? 'bg-amber-50 border-amber-400' : 'bg-white border-gray-200 hover:border-amber-300'}`}
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock bajo (≤mín)</p>
          <p className={`text-2xl font-bold mt-1 ${stockBajo > 0 ? 'text-amber-600' : 'text-gray-700'}`}>{stockBajo}</p>
        </button>
        {puedeVerPrecios && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor de inventario</p>
            <p className="text-xl font-bold text-green-600 mt-1">{fmt$(valorInventario)}</p>
          </div>
        )}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por ID, nombre o descripción..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filtros por categoría */}
      {categorias.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 self-center font-medium">Categorías:</span>
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(prev => prev === cat ? '' : cat)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                categoriaFiltro === cat
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {cat}
            </button>
          ))}
          {categoriaFiltro && (
            <button
              onClick={() => setCategoriaFiltro('')}
              className="text-xs px-3 py-1.5 rounded-full font-medium border border-red-300 text-red-600 hover:bg-red-50"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">ID</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase w-12">Img</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Nombre</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Descripción</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Categorías</th>
              {puedeVerPrecios && <th className="text-right px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">P. Compra</th>}
              {puedeVerPrecios && <th className="text-right px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">P. Venta</th>}
              <th className="text-right px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Stock</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Unidad</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">C. SAT Unidad</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">C. SAT Producto</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={10 + (puedeVerPrecios ? 2 : 0)} className="text-center py-12 text-gray-400">No se encontraron productos</td>
              </tr>
            )}
            {filtrados.map((p) => {
              const stockBajoItem = p.stock <= p.stock_minimo
              const cats = (p.categorias ?? p.categoria ?? '').split(';').map(c => c.trim()).filter(Boolean)
              return (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  {/* ID */}
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-bold text-blue-600 font-mono">{p.codigo ?? `#${p.id}`}</span>
                  </td>

                  {/* Imagen */}
                  <td className="px-3 py-2.5">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.nombre}
                        className="w-10 h-10 object-contain rounded border border-gray-100 bg-gray-50"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-300 text-xs">—</div>
                    )}
                  </td>

                  {/* Nombre */}
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <p className="font-medium text-gray-900 text-xs leading-snug line-clamp-2">{p.nombre}</p>
                  </td>

                  {/* Descripción */}
                  <td className="px-3 py-2.5 max-w-[160px]">
                    <p className="text-xs text-gray-600 leading-snug">{p.descripcion ?? <span className="text-gray-300">—</span>}</p>
                  </td>

                  {/* Categorías */}
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {cats.length === 0 ? <span className="text-gray-300 text-xs">—</span> : cats.map(c => (
                        <span key={c} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">{c}</span>
                      ))}
                    </div>
                  </td>

                  {/* P. Compra */}
                  {puedeVerPrecios && (
                    <td className="px-3 py-2.5 text-right">
                      <div className="text-xs font-medium text-gray-800">{fmt$(p.precio_compra_neto)}</div>
                      {p.precio_compra_incluye_iva ? (
                        <div className="text-[10px] text-gray-400">incl. IVA</div>
                      ) : (
                        <div className="text-[10px] text-gray-400">+IVA {p.iva_compra}% → {fmt$(p.precio_compra_con_iva)}</div>
                      )}
                    </td>
                  )}

                  {/* P. Venta */}
                  {puedeVerPrecios && (
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-xs font-bold text-green-700">{fmt$(p.precio_venta)}</span>
                    </td>
                  )}

                  {/* Stock */}
                  <td className="px-3 py-2.5 text-right">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                      p.stock === 0 ? 'bg-red-100 text-red-700'
                      : stockBajoItem ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                    }`}>
                      {stockBajoItem && <AlertCircle size={10} />}
                      {p.stock}
                    </span>
                  </td>

                  {/* Unidad */}
                  <td className="px-3 py-2.5 text-xs text-gray-600">{p.unidad}</td>

                  {/* Clave SAT Unidad */}
                  <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{p.clave_sat_unidad ?? <span className="text-gray-300">—</span>}</td>

                  {/* Clave SAT Producto */}
                  <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{p.clave_sat_producto ?? <span className="text-gray-300">—</span>}</td>

                  {/* Acciones */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      {puedeEditar && (
                        <button onClick={() => setModal({ open: true, producto: p })}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Pencil size={13} />
                        </button>
                      )}
                      {puedeEliminar && (
                        <button onClick={() => eliminar(p.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <ProductoModal
          producto={modal.producto}
          ivaDefault={ivaDefault}
          onClose={() => setModal({ open: false, producto: null })}
          onGuardado={onGuardado}
        />
      )}
    </div>
  )
}

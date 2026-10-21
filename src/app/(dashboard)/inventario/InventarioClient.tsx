'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, AlertCircle, Package } from 'lucide-react'
import type { Producto } from '@/types'
import ProductoModal from './ProductoModal'
import { borrar } from '@/lib/api-cliente'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { BotonIcono, BotonPrincipal, Buscador, EncabezadoPagina, EstadoVacio } from '@/components/ui/Pagina'
import { useCargaProgresiva, useMediaQuery } from '@/components/ui/listas'

interface Props {
  productos: Producto[]
  ivaDefault: number
  nivel: number
  filtroInicial?: 'sinstock' | 'bajo' | null
}

// Bajo stock = hay existencias pero ya llegó a su mínimo (los de mínimo 0 no generan alerta)
const esBajoStock = (p: Producto) => p.stock > 0 && p.stock_minimo > 0 && p.stock <= p.stock_minimo

function fmt$(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

export default function InventarioClient({ productos: inicial, ivaDefault, nivel, filtroInicial = null }: Props) {
  const [productos, setProductos] = useState<Producto[]>(inicial)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [stockFiltro, setStockFiltro] = useState<'sinstock' | 'bajo' | null>(filtroInicial)
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
          (stockFiltro === 'bajo' && esBajoStock(p))
        return matchQ && matchCat && matchStock
      })
  }, [productos, busqueda, categoriaFiltro, stockFiltro])

  // Página ligera: una sola vista (tarjetas o tabla) y los productos por tandas conforme se baja
  const pantallaAncha = useMediaQuery('(min-width: 1280px)')
  const { visibles, centinela, restantes } = useCargaProgresiva(filtrados)

  // Stats
  const totalProductos = productos.length
  const sinStock = productos.filter(p => p.stock === 0).length
  const stockBajo = productos.filter(esBajoStock).length
  const valorInventario = productos.reduce((acc, p) => acc + (p.precio_compra_neto ?? 0) * p.stock, 0)

  async function eliminar(id: number) {
    if (!(await confirmar({ titulo: '¿Eliminar este producto?', mensaje: 'Esta acción no se puede deshacer.', peligro: true }))) return
    if (!(await borrar(`/api/inventario/${id}`, 'No se pudo eliminar el producto'))) return
    setProductos(prev => prev.filter(p => p.id !== id))
  }

  function onGuardado(producto: Producto) {
    setProductos(prev => {
      const idx = prev.findIndex(p => p.id === producto.id)
      if (idx >= 0) { const arr = [...prev]; arr[idx] = producto; return arr }
      return [producto, ...prev]
    })
    setModal({ open: false, producto: null })
    aviso.exito(`Producto ${producto.nombre} guardado`)
  }

  const puedeAgregar    = nivel <= 2
  const puedeEditar     = nivel <= 2
  const puedeEliminar   = nivel <= 1
  const puedeVerPrecios = nivel <= 1

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Inventario"
        subtitulo={`${filtrados.length} de ${productos.length} productos`}
        acciones={puedeAgregar && (
          <BotonPrincipal onClick={() => setModal({ open: true, producto: null })}>
            <Plus size={17} /> <span>Nuevo producto</span>
          </BotonPrincipal>
        )}
      />

      {/* Resumen (las de stock funcionan como filtro) */}
      <div className={`grid grid-cols-2 gap-3 ${puedeVerPrecios ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-[13px] text-gray-500">Total de productos</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{totalProductos}</p>
        </div>
        <button
          onClick={() => setStockFiltro(prev => prev === 'sinstock' ? null : 'sinstock')}
          aria-pressed={stockFiltro === 'sinstock'}
          className={`rounded-2xl border p-4 text-left transition-colors ${stockFiltro === 'sinstock' ? 'border-red-400 bg-red-50 ring-2 ring-red-100' : 'border-gray-200 bg-white hover:border-red-300'}`}
        >
          <p className="text-[13px] text-gray-500">Sin stock</p>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${sinStock > 0 ? 'text-red-600' : 'text-gray-900'}`}>{sinStock}</p>
        </button>
        <button
          onClick={() => setStockFiltro(prev => prev === 'bajo' ? null : 'bajo')}
          aria-pressed={stockFiltro === 'bajo'}
          className={`rounded-2xl border p-4 text-left transition-colors ${stockFiltro === 'bajo' ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-100' : 'border-gray-200 bg-white hover:border-amber-300'}`}
        >
          <p className="text-[13px] text-gray-500">Stock bajo (≤ mínimo)</p>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${stockBajo > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{stockBajo}</p>
        </button>
        {puedeVerPrecios && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-[13px] text-gray-500">Valor de inventario</p>
            <p className="mt-1 truncate text-xl font-semibold tracking-tight text-green-700">{fmt$(valorInventario)}</p>
          </div>
        )}
      </div>

      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por código, nombre o descripción…" />

      {/* Filtros por categoría: desplazables de lado en celular */}
      {categorias.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {categoriaFiltro && (
              <button onClick={() => setCategoriaFiltro('')}
                className="whitespace-nowrap rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                ✕ Quitar filtro
              </button>
            )}
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoriaFiltro(prev => prev === cat ? '' : cat)}
                aria-pressed={categoriaFiltro === cat}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  categoriaFiltro === cat
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-brand-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtrados.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<Package size={22} />} titulo="No se encontraron productos"
            descripcion="Prueba con otra búsqueda o quita los filtros." />
        </div>
      )}

      {/* Celular, tableta y laptop: tarjetas */}
      {pantallaAncha !== true && <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
        {visibles.map((p) => {
          const cats = (p.categorias ?? p.categoria ?? '').split(';').map(c => c.trim()).filter(Boolean)
          const estadoStock = p.stock === 0 ? 'bg-red-100 text-red-700' : esBajoStock(p) ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
          return (
            <article key={p.id} className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm shadow-black/[0.02]">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white">
                {p.imagen_url
                  ? <img src={p.imagen_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : <Package size={22} className="text-gray-300" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-brand-700">{p.codigo ?? `#${p.id}`}</span>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${estadoStock}`}>
                    {(p.stock === 0 || esBajoStock(p)) && <AlertCircle size={11} />}
                    {p.stock} {p.unidad}
                  </span>
                </div>
                <h3 className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-gray-900">{p.nombre}</h3>
                {cats.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {cats.slice(0, 3).map(c => <span key={c} className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">{c}</span>)}
                  </div>
                )}
                <div className="mt-auto flex items-end justify-between pt-1">
                  {puedeVerPrecios
                    ? <span className="text-sm font-semibold text-green-700">{fmt$(p.precio_venta)}</span>
                    : <span />}
                  <div className="-mb-1.5 -mr-1.5 flex">
                    {puedeEditar && <BotonIcono titulo="Editar" tono="marca" onClick={() => setModal({ open: true, producto: p })}><Pencil size={16} /></BotonIcono>}
                    {puedeEliminar && <BotonIcono titulo="Eliminar" tono="peligro" onClick={() => eliminar(p.id)}><Trash2 size={16} /></BotonIcono>}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>}

      {/* Pantalla ancha: tabla */}
      {pantallaAncha !== false && <div className={`hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02] ${filtrados.length ? 'xl:block' : ''}`}>
        <table className="w-full text-sm">
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
            {visibles.map((p) => {
              const stockBajoItem = p.stock <= p.stock_minimo
              const cats = (p.categorias ?? p.categoria ?? '').split(';').map(c => c.trim()).filter(Boolean)
              return (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  {/* ID */}
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-bold text-brand-600 font-mono">{p.codigo ?? `#${p.id}`}</span>
                  </td>

                  {/* Imagen */}
                  <td className="px-3 py-2.5">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.nombre}
                        loading="lazy"
                        decoding="async"
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
                        <span key={c} className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">{c}</span>
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
                    <div className="flex items-center justify-end">
                      {puedeEditar && <BotonIcono titulo="Editar" tono="marca" onClick={() => setModal({ open: true, producto: p })}><Pencil size={15} /></BotonIcono>}
                      {puedeEliminar && <BotonIcono titulo="Eliminar" tono="peligro" onClick={() => eliminar(p.id)}><Trash2 size={15} /></BotonIcono>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>}

      {restantes > 0 && (
        <div ref={centinela} className="py-6 text-center text-sm text-gray-400">
          Cargando más productos… ({restantes} restantes)
        </div>
      )}

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

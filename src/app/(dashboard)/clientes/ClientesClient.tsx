'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight, ArrowUpDown } from 'lucide-react'
import type { Cliente } from '@/types'
import ClienteModal from './ClienteModal'

type Orden = 'id_asc' | 'id_desc' | 'nombre_az' | 'poliza'

interface Props {
  clientes: Cliente[]
  nivel: number
  esContador: boolean
}

export default function ClientesClient({ clientes: inicial, nivel, esContador }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>(inicial)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ open: boolean; cliente: Cliente | null }>({ open: false, cliente: null })
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [orden, setOrden] = useState<Orden>('id_asc')

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    let lista = clientes.filter((c) =>
      c.nombre.toLowerCase().includes(q) ||
      c.id.toString().includes(q) ||
      (c.rfc?.toLowerCase().includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    )
    switch (orden) {
      case 'id_desc':   lista = [...lista].sort((a, b) => b.id - a.id); break
      case 'nombre_az': lista = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); break
      case 'poliza':    lista = [...lista].sort((a, b) => (b.tiene_poliza ? 1 : 0) - (a.tiene_poliza ? 1 : 0)); break
      default:          lista = [...lista].sort((a, b) => a.id - b.id)
    }
    return lista
  }, [clientes, busqueda, orden])

  async function eliminar(id: number) {
    if (!confirm('¿Eliminar este cliente?')) return
    await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
    setClientes((prev) => prev.filter((c) => c.id !== id))
  }

  function toggleExpand(key: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function onGuardado(cliente: Cliente) {
    setClientes((prev) => {
      const idx = prev.findIndex((c) => c.id === cliente.id)
      if (idx >= 0) { const arr = [...prev]; arr[idx] = cliente; return arr }
      return [cliente, ...prev]
    })
    setModal({ open: false, cliente: null })
  }

  const puedeEditar    = nivel <= 2
  const puedeEliminar  = nivel <= 1
  const verDescuento   = nivel <= 1
  const verFiscal      = nivel <= 1 || esContador
  const gridTemplate = ['3rem', '1fr', verDescuento && '5.5rem', verFiscal && '7rem', verFiscal && '5rem', '14rem', '5rem'].filter(Boolean).join(' ')

  const ordenOpciones: { value: Orden; label: string }[] = [
    { value: 'id_asc',    label: 'ID ↑' },
    { value: 'id_desc',   label: 'ID ↓' },
    { value: 'nombre_az', label: 'A → Z' },
    { value: 'poliza',    label: 'Póliza primero' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtrados.length} cliente(s)</p>
        </div>
        {puedeEditar && (
          <button
            onClick={() => setModal({ open: true, cliente: null })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Nuevo cliente
          </button>
        )}
      </div>

      {/* Búsqueda + Orden */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por ID, nombre, RFC o correo..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1">
          <ArrowUpDown size={13} className="text-gray-400 shrink-0 mr-0.5" />
          {ordenOpciones.map((op) => (
            <button
              key={op.value}
              onClick={() => setOrden(op.value)}
              className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                orden === op.value ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Encabezado */}
        <div className="grid bg-gray-50 border-b border-gray-200 px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ gridTemplateColumns: gridTemplate }}>
          <div>ID</div>
          <div>Nombre / Razón social</div>
          {verDescuento && <div className="text-center">Desc.</div>}
          {verFiscal && <div>Régimen</div>}
          {verFiscal && <div>CFDI</div>}
          <div>Direcciones y contactos</div>
          <div className="text-right">Acc.</div>
        </div>

        {filtrados.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm">No se encontraron clientes</div>
        )}

        <div className="divide-y divide-gray-100">
          {filtrados.map((cliente) => {
            const dirs = cliente.direcciones?.length > 0
              ? cliente.direcciones
              : cliente.direccion
                ? [{ etiqueta: 'Principal', direccion: cliente.direccion, contactos: [] }]
                : []

            const contactosGral = cliente.contactos?.filter(c => c.nombre || c.email) ?? []

            return (
              <div key={cliente.id} className="grid items-start px-3 py-3 hover:bg-gray-50 transition-colors" style={{ gridTemplateColumns: gridTemplate }}>

                {/* ID */}
                <div className="text-sm font-bold text-blue-600 pt-0.5">#{cliente.id}</div>

                {/* Nombre */}
                <div className="min-w-0 pt-0.5 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 text-sm">{cliente.nombre}</p>
                    {cliente.tiene_poliza && (
                      <span className="shrink-0 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Póliza</span>
                    )}
                  </div>
                  {cliente.rfc && (
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">RFC: {cliente.rfc}</p>
                  )}
                  {cliente.notas && (
                    <p className="text-xs text-gray-400 mt-1 italic leading-tight">{cliente.notas}</p>
                  )}
                </div>

                {/* Descuento */}
                {verDescuento && (
                  <div className="text-center pt-0.5">
                    {cliente.descuento !== 0 ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        cliente.descuento > 0 ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                      }`}>
                        {cliente.descuento > 0 ? '+' : ''}{cliente.descuento}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                )}

                {/* Régimen fiscal */}
                {verFiscal && (
                  <div className="text-xs text-gray-600 pt-0.5">
                    {cliente.regimen_fiscal ?? <span className="text-gray-300">—</span>}
                  </div>
                )}

                {/* CFDI */}
                {verFiscal && (
                  <div className="text-xs text-gray-600 font-mono pt-0.5">
                    {cliente.uso_cfdi ?? <span className="text-gray-300">—</span>}
                  </div>
                )}

                {/* Direcciones — expansión inline dentro de la columna */}
                <div className="space-y-1.5">
                  {dirs.length === 0 && contactosGral.length === 0 && (
                    <span className="text-xs text-gray-300">Sin información</span>
                  )}

                  {dirs.map((d, i) => {
                    const key = `${cliente.id}-${i}`
                    const expandido = expandidos.has(key)
                    // Principal (i===0): muestra sus contactos + los contactos generales del cliente
                    // Secundarias: solo sus propios contactos
                    const contactosDir = d.contactos?.filter(c => c.nombre || c.email) ?? []
                    const contactosMostrar = i === 0
                      ? [
                          ...contactosGral,
                          ...contactosDir.filter(cd =>
                            !contactosGral.some(cg => cg.email && cg.email === cd.email && cg.nombre === cd.nombre)
                          )
                        ]
                      : contactosDir

                    return (
                      <div key={i}>
                        <button
                          onClick={() => toggleExpand(key)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 w-full text-left font-medium"
                        >
                          {expandido ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          {d.etiqueta || `Dir. ${i + 1}`}
                        </button>

                        {expandido && (
                          <div className="mt-1 ml-3 pl-2 border-l-2 border-blue-200 space-y-1.5">
                            {d.direccion && (
                              <p className="text-xs text-gray-600 leading-snug">{d.direccion}</p>
                            )}
                            {contactosMostrar.map((c, ci) => (
                              <div key={ci} className="text-xs space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {c.es_fiscal && (
                                    <span className="bg-amber-100 text-amber-700 px-1 py-0.5 rounded text-[10px] font-semibold">⭐ Fiscal</span>
                                  )}
                                  {c.nombre && <span className="font-medium text-gray-800">{c.nombre}</span>}
                                  {c.puesto && <span className="text-gray-400">{c.puesto}</span>}
                                </div>
                                {c.es_fiscal && cliente.rfc && (
                                  <div className="text-amber-700 font-mono pl-0.5 font-medium">RFC: {cliente.rfc}</div>
                                )}
                                {c.telefono && <div className="text-gray-500 pl-0.5">📞 {c.telefono}</div>}
                                {c.email && <div className="text-gray-500 pl-0.5">✉️ {c.email}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 justify-end pt-0.5">
                  {puedeEditar && (
                    <button onClick={() => setModal({ open: true, cliente })}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                      <Pencil size={14} />
                    </button>
                  )}
                  {puedeEliminar && (
                    <button onClick={() => eliminar(cliente.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modal.open && (
        <ClienteModal
          cliente={modal.cliente}
          onClose={() => setModal({ open: false, cliente: null })}
          onGuardado={onGuardado}
        />
      )}
    </div>
  )
}

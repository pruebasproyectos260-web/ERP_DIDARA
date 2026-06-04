'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, ExternalLink, Monitor, Search } from 'lucide-react'

interface Software {
  id: number
  nombre: string
  enlace: string
  descripcion?: string
  created_at: string
}

interface Props {
  softwareInit: Software[]
  nivel: number
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const btnPrimary = 'px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
const btnSecondary = 'px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'

const emptyForm = { nombre: '', enlace: '', descripcion: '' }

export default function SoftwareClient({ softwareInit, nivel }: Props) {
  const esAdmin = nivel <= 2

  const [lista, setLista] = useState<Software[]>(softwareInit)
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState<Software[]>([])
  const [mostrarSug, setMostrarSug] = useState(false)
  const busquedaRef = useRef<HTMLDivElement>(null)

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Software | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [err, setErr] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Click fuera cierra sugerencias
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (busquedaRef.current && !busquedaRef.current.contains(e.target as Node)) {
        setMostrarSug(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filtrar lista por búsqueda
  const listaFiltrada = useMemo(() => {
    if (!busqueda.trim()) return lista
    const q = busqueda.toLowerCase()
    return lista.filter(
      (s) => s.nombre.toLowerCase().includes(q) || (s.descripcion ?? '').toLowerCase().includes(q)
    )
  }, [lista, busqueda])

  function handleBusquedaChange(val: string) {
    setBusqueda(val)
    if (val.trim().length > 0) {
      const q = val.toLowerCase()
      setSugerencias(lista.filter((s) => s.nombre.toLowerCase().includes(q)).slice(0, 6))
      setMostrarSug(true)
    } else {
      setSugerencias([])
      setMostrarSug(false)
    }
  }

  function seleccionarSugerencia(s: Software) {
    setBusqueda(s.nombre)
    setMostrarSug(false)
  }

  function abrirNuevo() {
    setEditando(null)
    setForm(emptyForm)
    setErr('')
    setModal(true)
  }

  function abrirEditar(s: Software) {
    setEditando(s)
    setForm({ nombre: s.nombre, enlace: s.enlace, descripcion: s.descripcion ?? '' })
    setErr('')
    setModal(true)
  }

  function cerrar() {
    setModal(false)
    setEditando(null)
    setErr('')
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setGuardando(true)
    const payload = {
      nombre: form.nombre.trim(),
      enlace: form.enlace.trim(),
      descripcion: form.descripcion.trim() || null,
    }
    const url = editando ? `/api/software/${editando.id}` : '/api/software'
    const res = await fetch(url, {
      method: editando ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setGuardando(false)
    if (!res.ok) return setErr(json.error)
    if (editando) {
      setLista((p) => p.map((s) => s.id === editando.id ? json.data : s).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    } else {
      setLista((p) => [...p, json.data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    }
    cerrar()
  }

  async function eliminar(id: number, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    await fetch(`/api/software/${id}`, { method: 'DELETE' })
    setLista((p) => p.filter((s) => s.id !== id))
    if (busqueda) setBusqueda('')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Monitor className="text-blue-600" size={22} />
          <h1 className="text-2xl font-bold text-gray-900">Software</h1>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            {lista.length}
          </span>
        </div>
        {esAdmin && (
          <button onClick={abrirNuevo} className={btnPrimary + ' flex items-center gap-1.5'}>
            <Plus size={15} /> Agregar software
          </button>
        )}
      </div>

      {/* Buscador con autocompletado */}
      <div ref={busquedaRef} className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar software..."
          value={busqueda}
          onChange={(e) => handleBusquedaChange(e.target.value)}
          onFocus={() => busqueda.trim() && setMostrarSug(true)}
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {busqueda && (
          <button
            onClick={() => { setBusqueda(''); setMostrarSug(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
        {mostrarSug && sugerencias.length > 0 && (
          <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {sugerencias.map((s) => (
              <li
                key={s.id}
                onMouseDown={() => seleccionarSugerencia(s)}
                className="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2"
              >
                <Monitor size={13} className="text-gray-400 shrink-0" />
                <span className="font-medium">{s.nombre}</span>
                {s.descripcion && <span className="text-gray-400 truncate text-xs">— {s.descripcion}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {listaFiltrada.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay software registrado aún.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre del programa</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Descripción</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Enlace</th>
                  {esAdmin && <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listaFiltrada.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Monitor size={15} className="text-blue-500 shrink-0" />
                        <span className="font-medium text-gray-900">{s.nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">
                      {s.descripcion ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <a
                        href={s.enlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                      >
                        <ExternalLink size={12} />
                        Descargar
                      </a>
                    </td>
                    {esAdmin && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => abrirEditar(s)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => eliminar(s.id, s.nombre)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">
                {editando ? 'Editar software' : 'Agregar software'}
              </h2>
              <button onClick={cerrar} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={guardar} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del programa *</label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className={inputCls}
                  placeholder="Ej. TeamViewer, AnyDesk, WinRAR..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Enlace de descarga *</label>
                <input
                  type="url"
                  required
                  value={form.enlace}
                  onChange={(e) => setForm((f) => ({ ...f, enlace: e.target.value }))}
                  className={inputCls}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className={inputCls}
                  placeholder="Versión, uso, notas..."
                />
              </div>
              {err && <p className="text-sm text-red-600">{err}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={cerrar} className={btnSecondary}>Cancelar</button>
                <button type="submit" disabled={guardando} className={btnPrimary}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

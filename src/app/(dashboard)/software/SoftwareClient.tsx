'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, ExternalLink, Monitor, Search } from 'lucide-react'
import { borrar } from '@/lib/api-cliente'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { BotonIcono, BotonPrincipal, EncabezadoPagina, EstadoVacio } from '@/components/ui/Pagina'

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

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const btnPrimary = 'px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors'
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
    aviso.exito(editando ? 'Software actualizado' : 'Software agregado')
    cerrar()
  }

  async function eliminar(id: number, nombre: string) {
    if (!(await confirmar({ titulo: `¿Eliminar "${nombre}"?`, mensaje: 'Esta acción no se puede deshacer.', peligro: true }))) return
    if (!(await borrar(`/api/software/${id}`, 'No se pudo eliminar el software'))) return
    setLista((p) => p.filter((s) => s.id !== id))
    if (busqueda) setBusqueda('')
  }

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Software"
        subtitulo={`${lista.length} programa${lista.length === 1 ? '' : 's'} para descargar`}
        acciones={esAdmin && (
          <BotonPrincipal onClick={abrirNuevo}>
            <Plus size={17} /> <span>Agregar software</span>
          </BotonPrincipal>
        )}
      />

      {/* Buscador con autocompletado */}
      <div ref={busquedaRef} className="relative max-w-xl">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar software…"
          value={busqueda}
          onChange={(e) => handleBusquedaChange(e.target.value)}
          onFocus={() => busqueda.trim() && setMostrarSug(true)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
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
                className="px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 cursor-pointer flex items-center gap-2"
              >
                <Monitor size={13} className="text-gray-400 shrink-0" />
                <span className="font-medium">{s.nombre}</span>
                {s.descripcion && <span className="text-gray-400 truncate text-xs">— {s.descripcion}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Catálogo */}
      {listaFiltrada.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<Monitor size={22} />}
            titulo={busqueda ? `Sin resultados para “${busqueda}”` : 'No hay software registrado aún'}
            descripcion={busqueda ? 'Prueba con otro nombre.' : undefined} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {listaFiltrada.map((s) => {
            let dominio = ''
            try { dominio = new URL(s.enlace).hostname.replace(/^www\./, '') } catch { /* enlace no válido */ }
            return (
              <article key={s.id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm shadow-black/[0.02] transition-colors hover:border-brand-300">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Monitor size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold leading-snug text-gray-900">{s.nombre}</h3>
                    {dominio && <p className="truncate text-xs text-gray-400">{dominio}</p>}
                  </div>
                  {esAdmin && (
                    <div className="-mr-2 -mt-1 flex shrink-0">
                      <BotonIcono titulo="Editar" tono="marca" onClick={() => abrirEditar(s)}><Pencil size={15} /></BotonIcono>
                      <BotonIcono titulo="Eliminar" tono="peligro" onClick={() => eliminar(s.id, s.nombre)}><Trash2 size={15} /></BotonIcono>
                    </div>
                  )}
                </div>
                {s.descripcion && <p className="mt-2 line-clamp-2 text-sm text-gray-500">{s.descripcion}</p>}
                {/* Siempre al fondo de la tarjeta, aunque no haya descripción */}
                <div className="mt-auto pt-4">
                  <a
                    href={s.enlace}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
                  >
                    <ExternalLink size={14} />
                    Descargar
                  </a>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-aparecer sm:items-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full animate-subir max-h-[92dvh] overflow-y-auto max-w-md">
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

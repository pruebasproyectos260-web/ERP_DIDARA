'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Check, AlertTriangle, ClipboardList } from 'lucide-react'
import type { Pendiente, Cliente, Usuario } from '@/types'
import { borrar } from '@/lib/api-cliente'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { BotonIcono, BotonPrincipal, EncabezadoPagina, EstadoVacio, Segmentado } from '@/components/ui/Pagina'

const ESTADOS: Pendiente['estado'][] = ['Pendiente', 'Completado']

const estadoColor: Record<string, string> = {
  Pendiente:  'bg-yellow-100 text-yellow-700',
  Completado: 'bg-green-100 text-green-700',
}

function fmt(dateStr?: string) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function esVencido(p: Pendiente) {
  if (!p.fecha_max_entrega || p.estado === 'Completado') return false
  const hoy = new Date().toISOString().slice(0, 10)
  return p.fecha_max_entrega < hoy
}

const FORM_VACIO = {
  cliente_id: '',
  contacto_nombre: '',
  tecnico_ids: [] as string[],
  descripcion: '',
  fecha_solicitud: new Date().toISOString().slice(0, 10),
  fecha_max_entrega: '',
  estado: 'Pendiente' as Pendiente['estado'],
}

export default function PendientesPage() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre' | 'contactos'>[]>([])
  const [usuarios, setUsuarios] = useState<Pick<Usuario, 'id' | 'nombre'>[]>([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Pendiente | null>(null)
  const [form, setForm] = useState({ ...FORM_VACIO })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Autocomplete cliente
  const [clienteBusqueda, setClienteBusqueda] = useState('')
  const [clienteDropdown, setClienteDropdown] = useState(false)
  const clienteRef = useRef<HTMLDivElement>(null)

  const [filtroEstado, setFiltroEstado] = useState<string>('')

  useEffect(() => {
    Promise.all([
      fetch('/api/pendientes').then(r => r.json()),
      fetch('/api/clientes').then(r => r.json()),
      fetch('/api/admin/usuarios').then(r => r.json()),
    ]).then(([pend, cli, usr]) => {
      setPendientes(pend.data ?? [])
      setClientes(cli.data ?? [])
      setUsuarios(usr.data ?? [])
      setLoading(false)
    })
  }, [])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) {
        setClienteDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const clientesFiltrados = useMemo(() => {
    if (!clienteBusqueda.trim()) return clientes.slice(0, 8)
    const q = clienteBusqueda.toLowerCase()
    return clientes.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 8)
  }, [clienteBusqueda, clientes])

  const contactosCliente = useMemo(() => {
    if (!form.cliente_id) return []
    const cli = clientes.find(c => c.id.toString() === form.cliente_id)
    return cli?.contactos ?? []
  }, [form.cliente_id, clientes])

  const filtrados = useMemo(() => {
    return pendientes.filter(p => !filtroEstado || p.estado === filtroEstado)
  }, [pendientes, filtroEstado])

  function seleccionarCliente(c: Pick<Cliente, 'id' | 'nombre' | 'contactos'>) {
    setForm(f => ({ ...f, cliente_id: c.id.toString(), contacto_nombre: '' }))
    setClienteBusqueda(c.nombre)
    setClienteDropdown(false)
  }

  function limpiarCliente() {
    setForm(f => ({ ...f, cliente_id: '', contacto_nombre: '' }))
    setClienteBusqueda('')
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ ...FORM_VACIO, fecha_solicitud: new Date().toISOString().slice(0, 10) })
    setClienteBusqueda('')
    setError('')
    setModal(true)
  }

  function abrirEditar(p: Pendiente) {
    setEditando(p)
    setForm({
      cliente_id: p.cliente_id?.toString() ?? '',
      contacto_nombre: p.contacto_nombre ?? '',
      tecnico_ids: p.tecnico_ids ?? [],
      descripcion: p.descripcion,
      fecha_solicitud: p.fecha_solicitud,
      fecha_max_entrega: p.fecha_max_entrega ?? '',
      estado: p.estado,
    })
    setClienteBusqueda(p.cliente_nombre ?? '')
    setError('')
    setModal(true)
  }

  function toggleTecnico(id: string) {
    setForm(prev => ({
      ...prev,
      tecnico_ids: prev.tecnico_ids.includes(id)
        ? prev.tecnico_ids.filter(t => t !== id)
        : [...prev.tecnico_ids, id],
    }))
  }

  async function guardar(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!form.descripcion.trim()) return setError('La descripción es requerida')
    if (!form.fecha_solicitud) return setError('La fecha de solicitud es requerida')
    setGuardando(true)
    setError('')

    const clienteSeleccionado = clientes.find(c => c.id.toString() === form.cliente_id)
    const payload = {
      cliente_id: form.cliente_id ? parseInt(form.cliente_id) : null,
      cliente_nombre: clienteSeleccionado?.nombre ?? (clienteBusqueda || null),
      contacto_nombre: form.contacto_nombre || null,
      tecnico_ids: form.tecnico_ids,
      descripcion: form.descripcion,
      fecha_solicitud: form.fecha_solicitud,
      fecha_max_entrega: form.fecha_max_entrega || null,
      estado: form.estado,
    }

    try {
      const res = await fetch(
        editando ? `/api/pendientes/${editando.id}` : '/api/pendientes',
        {
          method: editando ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const json = await res.json()
      if (!res.ok) return setError(json.error ?? 'Error al guardar')
      if (editando) {
        setPendientes(prev => prev.map(p => p.id === editando.id ? json.data : p))
      } else {
        setPendientes(prev => [json.data, ...prev])
      }
      setModal(false)
      aviso.exito(editando ? 'Pendiente actualizado' : 'Pendiente creado')
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(id: number) {
    if (!(await confirmar({ titulo: '¿Eliminar este pendiente?', mensaje: 'Esta acción no se puede deshacer.', peligro: true }))) return
    if (!(await borrar(`/api/pendientes/${id}`, 'No se pudo eliminar el pendiente'))) return
    setPendientes(prev => prev.filter(p => p.id !== id))
  }

  async function toggleEstado(p: Pendiente) {
    const nuevoEstado: Pendiente['estado'] = p.estado === 'Completado' ? 'Pendiente' : 'Completado'
    const res = await fetch(`/api/pendientes/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
    const json = await res.json()
    if (res.ok) {
      if (nuevoEstado === 'Completado') {
        // Se eliminará automáticamente en 2 días; solo actualizamos en UI
        setPendientes(prev => prev.map(item => item.id === p.id ? json.data : item))
      } else {
        setPendientes(prev => prev.map(item => item.id === p.id ? json.data : item))
      }
    }
  }

  const techName = (id: string) => usuarios.find(u => u.id === id)?.nombre ?? id

  const vencidos = pendientes.filter(esVencido).length

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Pendientes"
        subtitulo={<>
          {filtrados.length} pendiente{filtrados.length === 1 ? '' : 's'}
          {vencidos > 0 && <span className="ml-2 font-medium text-red-600">· {vencidos} vencido{vencidos === 1 ? '' : 's'}</span>}
        </>}
        acciones={
          <BotonPrincipal onClick={abrirNuevo}>
            <Plus size={17} /> <span>Nuevo pendiente</span>
          </BotonPrincipal>
        }
      />

      <Segmentado
        opciones={[{ value: '', label: 'Todos' }, ...ESTADOS.map((e) => ({ value: e as string, label: e }))]}
        valor={filtroEstado}
        onCambio={setFiltroEstado}
      />

      {!loading && filtrados.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<ClipboardList size={22} />} titulo="No hay pendientes" descripcion="Todo al día por aquí." />
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl border border-gray-200 bg-white animate-brillo" />)}
        </div>
      )}

      {/* Celular y tableta: tarjetas */}
      {!loading && (
        <div className="space-y-3 lg:hidden">
          {filtrados.map(p => {
            const vencido = esVencido(p)
            const completado = p.estado === 'Completado'
            return (
              <article key={p.id}
                className={`flex gap-3 rounded-2xl border bg-white p-4 shadow-sm shadow-black/[0.02] ${vencido ? 'border-red-200' : 'border-gray-200'}`}>
                <button
                  onClick={() => toggleEstado(p)}
                  aria-label={completado ? 'Marcar como pendiente' : 'Marcar como completado'}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    completado ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 hover:border-brand-500'}`}
                >
                  {completado && <Check size={14} strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-semibold leading-snug ${completado ? 'text-gray-400 line-through' : vencido ? 'text-red-700' : 'text-gray-900'}`}>
                      {p.cliente_nombre ?? 'Sin cliente'}
                    </h3>
                    <div className="-mr-2 -mt-1.5 flex shrink-0">
                      <BotonIcono titulo="Editar" tono="marca" onClick={() => abrirEditar(p)}><Pencil size={15} /></BotonIcono>
                      <BotonIcono titulo="Eliminar" tono="peligro" onClick={() => eliminar(p.id)}><Trash2 size={15} /></BotonIcono>
                    </div>
                  </div>
                  <p className={`mt-0.5 text-sm ${completado ? 'text-gray-400' : 'text-gray-700'}`}>{p.descripcion}</p>
                  {p.contacto_nombre && <p className="mt-1 text-xs text-gray-500">Contacto: {p.contacto_nombre}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {p.tecnico_ids.map(id => (
                      <span key={id} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{techName(id)}</span>
                    ))}
                    {p.fecha_max_entrega && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${vencido ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {vencido && <AlertTriangle size={11} />}Entrega {fmt(p.fecha_max_entrega)}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Escritorio: tabla */}
      <div className={`hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02] ${!loading && filtrados.length ? 'lg:block' : ''}`}>
        {loading ? null : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Contacto Responsable</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Técnico(s)</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Descripción</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">F. Solicitud</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">F. Máx. Entrega</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">No hay pendientes</td>
                </tr>
              )}
              {filtrados.map(p => {
                const vencido = esVencido(p)
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${vencido ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 font-medium max-w-[140px]">
                      <div className="flex items-center gap-1">
                        {vencido && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                        <span className={vencido ? 'text-red-700' : 'text-gray-900'}>
                          {p.cliente_nombre ?? <span className="text-gray-400 font-normal">—</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[130px]">
                      {p.contacto_nombre ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      {p.tecnico_ids.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {p.tecnico_ids.map(id => (
                            <span key={id} className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full font-medium">
                              {techName(id)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                      <p className="line-clamp-2 text-xs">{p.descripcion}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{fmt(p.fecha_solicitud)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className={vencido ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                        {fmt(p.fecha_max_entrega)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleEstado(p)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-opacity hover:opacity-75 ${estadoColor[p.estado]}`}
                      >
                        {p.estado}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <BotonIcono titulo="Editar" tono="marca" onClick={() => abrirEditar(p)}><Pencil size={15} /></BotonIcono>
                        <BotonIcono titulo="Eliminar" tono="peligro" onClick={() => eliminar(p.id)}><Trash2 size={15} /></BotonIcono>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-aparecer sm:items-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full animate-subir max-w-lg flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-lg font-semibold">
                {editando ? 'Editar pendiente' : 'Nuevo pendiente'}
              </h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={guardar} className="px-6 py-4 space-y-4 overflow-y-auto flex-1">

              {/* Autocomplete cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <div ref={clienteRef} className="relative">
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500">
                    <input
                      type="text"
                      value={clienteBusqueda}
                      onChange={e => {
                        setClienteBusqueda(e.target.value)
                        setForm(f => ({ ...f, cliente_id: '', contacto_nombre: '' }))
                        setClienteDropdown(true)
                      }}
                      onFocus={() => setClienteDropdown(true)}
                      placeholder="Buscar cliente..."
                      className="flex-1 px-3 py-2 text-sm outline-none"
                    />
                    {clienteBusqueda && (
                      <button
                        type="button"
                        onClick={limpiarCliente}
                        className="px-2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {clienteDropdown && clientesFiltrados.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      <li>
                        <button
                          type="button"
                          onClick={limpiarCliente}
                          className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50"
                        >
                          Sin cliente
                        </button>
                      </li>
                      {clientesFiltrados.map(c => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => seleccionarCliente(c)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 hover:text-brand-700 ${
                              form.cliente_id === c.id.toString() ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700'
                            }`}
                          >
                            {c.nombre}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {form.cliente_id && (
                  <p className="text-[10px] text-green-600 mt-0.5">Cliente seleccionado</p>
                )}
              </div>

              {/* Contacto responsable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contacto Responsable</label>
                {contactosCliente.length > 0 ? (
                  <select
                    value={form.contacto_nombre}
                    onChange={e => setForm(f => ({ ...f, contacto_nombre: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Sin contacto</option>
                    {contactosCliente.map((c, i) => (
                      <option key={i} value={c.nombre}>{c.nombre}{c.puesto ? ` (${c.puesto})` : ''}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.contacto_nombre}
                    onChange={e => setForm(f => ({ ...f, contacto_nombre: e.target.value }))}
                    placeholder="Nombre del contacto"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                )}
              </div>

              {/* Técnico(s) responsable(s) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Técnico(s) Responsable(s)</label>
                <div className="border border-gray-300 rounded-lg p-2 max-h-32 overflow-y-auto grid grid-cols-2 gap-1">
                  {usuarios.map(u => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={form.tecnico_ids.includes(u.id)}
                        onChange={() => toggleTecnico(u.id)}
                        className="rounded border-gray-300 text-brand-600"
                      />
                      {u.nombre}
                    </label>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Solicitud <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.fecha_solicitud}
                    onChange={e => setForm(f => ({ ...f, fecha_solicitud: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Máx. de Entrega</label>
                  <input
                    type="date"
                    value={form.fecha_max_entrega}
                    onChange={e => setForm(f => ({ ...f, fecha_max_entrega: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={form.estado}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value as Pendiente['estado'] }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
            </form>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
              <button
                onClick={() => setModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 rounded-lg transition-colors"
              >
                <Check size={14} />
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

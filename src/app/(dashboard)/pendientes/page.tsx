'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import type { Pendiente, Cliente, Usuario } from '@/types'

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

  // Contactos del cliente seleccionado
  const contactosCliente = useMemo(() => {
    if (!form.cliente_id) return []
    const cli = clientes.find(c => c.id.toString() === form.cliente_id)
    return cli?.contactos ?? []
  }, [form.cliente_id, clientes])

  const filtrados = useMemo(() => {
    return pendientes.filter(p => !filtroEstado || p.estado === filtroEstado)
  }, [pendientes, filtroEstado])

  function abrirNuevo() {
    setEditando(null)
    setForm({ ...FORM_VACIO, fecha_solicitud: new Date().toISOString().slice(0, 10) })
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
      cliente_nombre: clienteSeleccionado?.nombre ?? null,
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
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(id: number) {
    if (!confirm('¿Eliminar este pendiente?')) return
    await fetch(`/api/pendientes/${id}`, { method: 'DELETE' })
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
    if (res.ok) setPendientes(prev => prev.map(item => item.id === p.id ? json.data : item))
  }

  const techName = (id: string) => usuarios.find(u => u.id === id)?.nombre ?? id

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pendientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtrados.length} pendiente(s)</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Nuevo pendiente
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">Estado:</span>
        {(['', ...ESTADOS] as string[]).map(e => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
              filtroEstado === e
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {e || 'Todos'}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Cargando...</div>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
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
              {filtrados.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[140px]">
                    {p.cliente_nombre ?? <span className="text-gray-400">—</span>}
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
                          <span key={id} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
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
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{fmt(p.fecha_max_entrega)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleEstado(p)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-opacity hover:opacity-75 ${estadoColor[p.estado]}`}
                    >
                      {p.estado}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => abrirEditar(p)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => eliminar(p.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-lg font-semibold">
                {editando ? 'Editar pendiente' : 'Nuevo pendiente'}
              </h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={guardar} className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select
                  value={form.cliente_id}
                  onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value, contacto_nombre: '' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin cliente</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Contacto responsable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contacto Responsable</label>
                {contactosCliente.length > 0 ? (
                  <select
                    value={form.contacto_nombre}
                    onChange={e => setForm(f => ({ ...f, contacto_nombre: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="rounded border-gray-300 text-blue-600"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Máx. de Entrega</label>
                  <input
                    type="date"
                    value={form.fecha_max_entrega}
                    onChange={e => setForm(f => ({ ...f, fecha_max_entrega: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={form.estado}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value as Pendiente['estado'] }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
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

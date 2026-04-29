'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, ExternalLink, Eye, Mail, Loader2, X } from 'lucide-react'
import type { Reporte } from '@/types'
import ReporteModal from './ReporteModal'

export interface ClienteParaReporte {
  id: number
  nombre: string
  direccion?: string
  direcciones?: { etiqueta: string; direccion: string }[]
}

export interface TecnicoParaReporte {
  id: string
  nombre: string
}

interface Props {
  reportes: Reporte[]
  clientes: ClienteParaReporte[]
  tecnicos: TecnicoParaReporte[]
  nivel: number
}

const estadoConfig: Record<string, string> = {
  abierto:    'bg-blue-100 text-blue-700 border-blue-200',
  en_proceso: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completado: 'bg-green-100 text-green-700 border-green-200',
  entregado:  'bg-purple-100 text-purple-700 border-purple-200',
  cancelado:  'bg-gray-100 text-gray-600 border-gray-200',
}

const rowColors: Record<string, string> = {
  abierto:    '',
  en_proceso: 'bg-yellow-50',
  completado: 'bg-green-50',
  entregado:  'bg-purple-50',
  cancelado:  'bg-gray-50',
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

interface ContactoMail { nombre: string; cargo?: string; email: string; telefono?: string }
interface UsuarioMail  { id: string; nombre: string; correo: string }

interface MailRepState {
  rep: Reporte
  contactos: ContactoMail[]
  usuarios: UsuarioMail[]
  cargando: boolean
  selected: Set<string>
  mensaje: string
  adjuntar: boolean
  enviando: boolean
  error: string
  ok: boolean
}

export default function ReportesClient({ reportes: inicial, clientes, tecnicos, nivel }: Props) {
  const [reportes, setReportes] = useState<Reporte[]>(inicial)
  const [modal, setModal] = useState<{ open: boolean; reporte: Reporte | null }>({
    open: false, reporte: null,
  })
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [verDetalle, setVerDetalle] = useState<Reporte | null>(null)
  const [mailState, setMailState] = useState<MailRepState | null>(null)

  const filtrados = reportes.filter((r) => {
    const matchEstado = !filtroEstado || r.estado === filtroEstado
    const q = busqueda.toLowerCase()
    const cliente = (r.cliente as { nombre: string } | undefined)?.nombre ?? ''
    const matchQ = !q || r.folio.toLowerCase().includes(q) || cliente.toLowerCase().includes(q) || r.equipo.toLowerCase().includes(q)
    return matchEstado && matchQ
  }).sort((a, b) => b.id - a.id)

  async function eliminar(id: number) {
    if (!confirm('¿Eliminar este reporte?')) return
    await fetch(`/api/reportes/${id}`, { method: 'DELETE' })
    setReportes((prev) => prev.filter((r) => r.id !== id))
    if (verDetalle?.id === id) setVerDetalle(null)
  }

  function abrirPDF(id: number) {
    window.open(`/api/pdf/reporte/${id}`, '_blank')
  }

  function abrirMail(r: Reporte) {
    const clienteObj = r.cliente as { email?: string; contactos?: { nombre?: string; puesto?: string; email?: string; telefono?: string }[]; direcciones?: { contactos?: { nombre?: string; puesto?: string; email?: string; telefono?: string }[] }[] } | undefined

    const contactos: ContactoMail[] = []
    const seen = new Set<string>()
    const add = (c: { nombre?: string; puesto?: string; email?: string; telefono?: string }) => {
      if (c.email && !seen.has(c.email)) { seen.add(c.email); contactos.push({ nombre: c.nombre ?? 'Contacto', cargo: c.puesto, email: c.email, telefono: c.telefono }) }
    }

    clienteObj?.contactos?.forEach(add)
    clienteObj?.direcciones?.forEach((d) => d.contactos?.forEach(add))
    if (clienteObj?.email && !seen.has(clienteObj.email)) {
      const clienteNombre = (r.cliente as { nombre?: string } | undefined)?.nombre ?? 'Cliente'
      contactos.push({ nombre: clienteNombre, email: clienteObj.email })
    }

    setMailState({
      rep: r,
      contactos,
      usuarios: [],
      cargando: true,
      selected: new Set(),
      mensaje: '',
      adjuntar: true,
      enviando: false,
      error: '',
      ok: false,
    })

    fetch('/api/usuarios/correo')
      .then((r) => r.json())
      .then((j) => setMailState((s) => s && ({ ...s, cargando: false, usuarios: j.data ?? [] })))
      .catch(() => setMailState((s) => s && ({ ...s, cargando: false })))
  }

  function toggleEmail(email: string) {
    setMailState((s) => {
      if (!s) return s
      const next = new Set(s.selected)
      next.has(email) ? next.delete(email) : next.add(email)
      return { ...s, selected: next }
    })
  }

  async function enviarMail() {
    if (!mailState) return
    const destinatarios = Array.from(mailState.selected)
    if (!destinatarios.length) { setMailState((s) => s && ({ ...s, error: 'Selecciona al menos un destinatario.' })); return }
    setMailState((s) => s && ({ ...s, enviando: true, error: '', ok: false }))
    const res = await fetch('/api/correo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinatarios,
        mensaje_adicional: mailState.mensaje || undefined,
        reporte_id: mailState.rep.id,
        adjuntar_pdf: mailState.adjuntar,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setMailState((s) => s && ({ ...s, enviando: false, error: json.error ?? 'Error al enviar' }))
    } else {
      setMailState((s) => s && ({ ...s, enviando: false, ok: true }))
    }
  }

  function onGuardado(reporte: Reporte) {
    setReportes((prev) => {
      const idx = prev.findIndex((r) => r.id === reporte.id)
      if (idx >= 0) { const arr = [...prev]; arr[idx] = reporte; return arr }
      return [reporte, ...prev]
    })
    setModal({ open: false, reporte: null })
  }

  const puedeEditar  = nivel <= 2
  const puedeEliminar = nivel <= 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes de Servicio</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtrados.length} reporte(s)</p>
        </div>
        {puedeEditar && (
          <button
            onClick={() => setModal({ open: true, reporte: null })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Nuevo reporte
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por folio, cliente o equipo..."
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        {['', 'abierto', 'en_proceso', 'completado', 'entregado', 'cancelado'].map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              filtroEstado === e
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {e === '' ? 'Todos' : e.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Folio</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Fecha</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Cliente</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Equipo</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Técnico</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Estado</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Total</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-16 text-gray-400 text-sm">
                  {busqueda || filtroEstado ? 'Sin resultados' : 'No hay reportes aún'}
                </td>
              </tr>
            )}
            {filtrados.map((r) => {
              const cliente = (r.cliente as { nombre: string } | undefined)?.nombre ?? '—'
              const tecnico = (r.tecnico as { nombre: string } | undefined)?.nombre ?? '—'
              const rowCls = rowColors[r.estado] ?? ''
              const badgeCls = estadoConfig[r.estado] ?? estadoConfig.abierto
              const equipoStr = [r.equipo, r.marca, r.modelo].filter(Boolean).join(' · ')
              return (
                <tr key={r.id} className={`${rowCls} border-b border-gray-100 hover:brightness-95 transition-all`}>
                  <td className="px-3 py-2.5">
                    <span className="font-bold text-xs font-mono text-blue-700">{r.folio}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                    {formatDate(r.fecha_ingreso)}
                    {r.fecha_entrega ? <div className="text-gray-400">→ {formatDate(r.fecha_entrega)}</div> : null}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[160px] truncate">{cliente}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[200px] truncate">{equipoStr}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{tecnico}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeCls}`}>
                      {r.estado.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                    ${Number(r.total).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setVerDetalle(verDetalle?.id === r.id ? null : r)}
                        className={`p-1.5 rounded-lg transition-colors ${verDetalle?.id === r.id ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title="Ver detalle"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => abrirPDF(r.id)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Ver PDF"
                      >
                        <ExternalLink size={13} />
                      </button>
                      {puedeEditar && (
                        <button
                          onClick={() => abrirMail(r)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Enviar por correo"
                        >
                          <Mail size={13} />
                        </button>
                      )}
                      {puedeEditar && (
                        <button
                          onClick={() => setModal({ open: true, reporte: r })}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {puedeEliminar && (
                        <button
                          onClick={() => eliminar(r.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
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

      {/* Modal ver detalle */}
      {verDetalle && (() => {
        const r = verDetalle
        const cliente = (r.cliente as { nombre: string } | undefined)?.nombre ?? '—'
        const tecnico = (r.tecnico as { nombre: string } | undefined)?.nombre ?? '—'
        return (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) setVerDetalle(null) }}
          >
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 w-full max-w-2xl my-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold font-mono text-blue-700">{r.folio}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${estadoConfig[r.estado] ?? ''}`}>
                      {r.estado.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Ingreso: {formatDate(r.fecha_ingreso)}
                    {r.fecha_entrega ? ` · Entrega: ${formatDate(r.fecha_entrega)}` : ''}
                  </p>
                </div>
                <button onClick={() => setVerDetalle(null)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                <div><span className="text-gray-500">Cliente:</span> <span className="font-medium">{cliente}</span></div>
                <div><span className="text-gray-500">Técnico:</span> <span className="text-gray-700">{tecnico}</span></div>
                <div><span className="text-gray-500">Equipo:</span> <span className="text-gray-700">{[r.equipo, r.marca, r.modelo, r.serie].filter(Boolean).join(' · ')}</span></div>
                {r.tipo_servicio?.length > 0 && (
                  <div><span className="text-gray-500">Servicio:</span> <span className="text-gray-700">{r.tipo_servicio.join(', ')}</span></div>
                )}
                {r.direccion_servicio && (
                  <div className="col-span-2"><span className="text-gray-500">Dirección:</span> <span className="text-gray-700">{r.direccion_servicio}</span></div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Falla reportada</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">{r.falla_reportada}</p>
              </div>
              {r.diagnostico && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Diagnóstico</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">{r.diagnostico}</p>
                </div>
              )}
              {r.trabajos_realizados?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Trabajos realizados</p>
                  <ul className="text-sm text-gray-700 space-y-0.5">
                    {r.trabajos_realizados.map((t, i) => <li key={i} className="flex gap-2"><span className="text-green-600">•</span>{t}</li>)}
                  </ul>
                </div>
              )}
              {r.items?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Materiales y cargos</p>
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="bg-gray-50 border-y border-gray-200">
                      <th className="text-left px-2 py-1 font-medium text-gray-500">Descripción</th>
                      <th className="text-center px-2 py-1 font-medium text-gray-500">Cant.</th>
                      <th className="text-right px-2 py-1 font-medium text-gray-500">Subtotal</th>
                    </tr></thead>
                    <tbody>{r.items.map((item, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-2 py-1 text-gray-700">{item.descripcion}</td>
                        <td className="px-2 py-1 text-center text-gray-600">{item.cantidad}</td>
                        <td className="px-2 py-1 text-right font-medium">${Number(item.subtotal).toFixed(2)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <div className="flex justify-end mt-1">
                    <span className="text-sm font-bold text-gray-900">Total: ${Number(r.total).toFixed(2)}</span>
                  </div>
                </div>
              )}
              {r.observaciones && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Observaciones</p>
                  <p className="text-sm text-gray-600 italic">{r.observaciones}</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Modal: Enviar por correo */}
      {mailState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-indigo-600" />
                <h2 className="text-base font-semibold text-gray-900">Enviar reporte {mailState.rep.folio}</h2>
              </div>
              <button onClick={() => setMailState(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              {mailState.ok ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Mail size={22} className="text-green-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">Correo enviado correctamente</p>
                  <p className="text-xs text-gray-500">Enviado a {mailState.selected.size} destinatario(s)</p>
                  <button onClick={() => setMailState(null)}
                    className="mt-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                    Cerrar
                  </button>
                </div>
              ) : (
                <>
                  {/* Contactos del cliente */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Contactos del cliente</p>
                    {mailState.cargando ? (
                      <p className="text-xs text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Cargando...</p>
                    ) : mailState.contactos.length === 0 ? (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Sin contactos con correo registrado. Agrégalos desde la sección Clientes.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {mailState.contactos.map((c) => (
                          <label key={c.email} className="flex items-start gap-2.5 p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors">
                            <input type="checkbox" checked={mailState.selected.has(c.email)} onChange={() => toggleEmail(c.email)} className="mt-0.5 rounded" />
                            <span>
                              <span className="text-sm font-medium text-gray-800">{c.nombre}</span>
                              {c.cargo && <span className="text-xs text-gray-400 ml-1.5">{c.cargo}</span>}
                              <br />
                              <span className="text-xs text-indigo-600">{c.email}</span>
                              {c.telefono && <span className="text-xs text-gray-400 ml-2">{c.telefono}</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Usuarios de la empresa */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Usuarios de la empresa</p>
                    {mailState.cargando ? (
                      <p className="text-xs text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Cargando...</p>
                    ) : mailState.usuarios.length === 0 ? (
                      <p className="text-xs text-gray-400">Sin usuarios con correo registrado.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {mailState.usuarios.map((u) => (
                          <label key={u.id} className="flex items-start gap-2.5 p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-purple-50 hover:border-purple-200 transition-colors">
                            <input type="checkbox" checked={mailState.selected.has(u.correo)} onChange={() => toggleEmail(u.correo)} className="mt-0.5 rounded" />
                            <span>
                              <span className="text-sm font-medium text-gray-800">{u.nombre}</span>
                              <br />
                              <span className="text-xs text-purple-600">{u.correo}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mensaje extra */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mensaje personalizado (opcional)</label>
                    <textarea rows={3} value={mailState.mensaje}
                      onChange={(e) => setMailState((s) => s && ({ ...s, mensaje: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Escribe un mensaje personalizado para incluir en el correo..." />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={mailState.adjuntar}
                      onChange={(e) => setMailState((s) => s && ({ ...s, adjuntar: e.target.checked }))}
                      className="rounded" />
                    <span className="text-sm text-gray-700">Adjuntar PDF del reporte</span>
                  </label>

                  <p className="text-xs text-gray-400">
                    Se enviará copia automática a <strong>direccion@didara-ti.com</strong>
                  </p>

                  {mailState.error && <p className="text-sm text-red-600">{mailState.error}</p>}
                </>
              )}
            </div>
            {!mailState.ok && (
              <div className="px-5 pb-4 pt-2 border-t border-gray-100 shrink-0 flex justify-end gap-2">
                <button onClick={() => setMailState(null)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={enviarMail} disabled={mailState.enviando || mailState.selected.size === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
                  {mailState.enviando ? <><Loader2 size={14} className="animate-spin" />Enviando...</> : <><Mail size={14} />Enviar</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {modal.open && (
        <ReporteModal
          reporte={modal.reporte}
          clientes={clientes}
          tecnicos={tecnicos}
          onClose={() => setModal({ open: false, reporte: null })}
          onGuardado={onGuardado}
        />
      )}
    </div>
  )
}

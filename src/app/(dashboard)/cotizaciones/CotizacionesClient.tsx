'use client'

import { useState } from 'react'
import { Plus, ExternalLink, Pencil, Trash2, Eye, X, ArrowUp, ArrowDown, Mail, Loader2 } from 'lucide-react'
import type { Cotizacion, EstadoCotizacion } from '@/types'
import CotizacionModal from './CotizacionModal'
import type { ClienteParaCot, ProductoParaCot } from './CotizacionModal'

interface Props {
  cotizaciones: Cotizacion[]
  clientes: ClienteParaCot[]
  productos: ProductoParaCot[]
  ivaDefault: number
  nivel: number
}

const ESTADOS: EstadoCotizacion[] = ['borrador', 'pendiente', 'enviada', 'aprobada', 'aceptada', 'rechazada', 'facturada', 'cancelada', 'pagada']

const estadoConfig: Record<string, { row: string; badge: string }> = {
  borrador:  { row: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  pendiente: { row: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  enviada:   { row: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  aprobada:  { row: 'bg-green-50',   badge: 'bg-green-100 text-green-800 border-green-300' },
  aceptada:  { row: 'bg-green-50',   badge: 'bg-green-100 text-green-800 border-green-300' },
  rechazada: { row: 'bg-red-50',     badge: 'bg-red-100 text-red-800 border-red-300' },
  facturada: { row: 'bg-indigo-50',  badge: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  cancelada: { row: 'bg-gray-50',    badge: 'bg-gray-100 text-gray-600 border-gray-300' },
  pagada:    { row: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
}

function fmt$(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface ContactoMail { nombre: string; cargo?: string; email: string; telefono?: string }
interface UsuarioMail  { id: string; nombre: string; correo: string }

interface MailState {
  cot: Cotizacion
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

export default function CotizacionesClient({ cotizaciones: inicial, clientes, productos, ivaDefault, nivel }: Props) {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>(inicial)
  const [modal, setModal] = useState<{ open: boolean; cotizacion: Cotizacion | null }>({ open: false, cotizacion: null })
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cotizacionVer, setCotizacionVer] = useState<Cotizacion | null>(null)
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [mailState, setMailState] = useState<MailState | null>(null)

  const filtradas = cotizaciones.filter((c) => {
    const matchEstado = !filtroEstado || c.estado === filtroEstado
    const q = busqueda.toLowerCase()
    const clienteNombre = (c.cliente as { nombre: string } | undefined)?.nombre ?? ''
    const matchQ = !q || c.folio.toLowerCase().includes(q) || clienteNombre.toLowerCase().includes(q)
    return matchEstado && matchQ
  }).sort((a, b) => sortDir === 'desc' ? b.id - a.id : a.id - b.id)

  async function eliminar(id: number) {
    if (!confirm('¿Eliminar esta cotización?')) return
    await fetch(`/api/cotizaciones/${id}`, { method: 'DELETE' })
    setCotizaciones((prev) => prev.filter((c) => c.id !== id))
  }

  async function cambiarEstado(id: number, estado: EstadoCotizacion) {
    setCotizaciones((prev) => prev.map((c) => c.id === id ? { ...c, estado } : c))
    await fetch(`/api/cotizaciones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
  }

  function abrirPDF(id: number) {
    window.open(`/api/pdf/cotizacion/${id}`, '_blank')
  }

  function abrirMail(cot: Cotizacion) {
    const contactosCot: ContactoMail[] = (cot.contactos_cotizacion ?? [])
      .filter((c) => c.email)
      .map((c) => ({ nombre: c.nombre ?? 'Contacto', cargo: c.puesto, email: c.email!, telefono: c.telefono }))

    const seen = new Set(contactosCot.map((c) => c.email))
    const clienteObj = cot.cliente as { email?: string; contactos?: { nombre?: string; puesto?: string; email?: string; telefono?: string }[]; direcciones?: { contactos?: { nombre?: string; puesto?: string; email?: string; telefono?: string }[] }[] } | undefined

    clienteObj?.contactos?.forEach((c) => {
      if (c.email && !seen.has(c.email)) { seen.add(c.email); contactosCot.push({ nombre: c.nombre ?? 'Contacto', cargo: c.puesto, email: c.email, telefono: c.telefono }) }
    })
    clienteObj?.direcciones?.forEach((d) => {
      d.contactos?.forEach((c) => {
        if (c.email && !seen.has(c.email)) { seen.add(c.email); contactosCot.push({ nombre: c.nombre ?? 'Contacto', cargo: c.puesto, email: c.email, telefono: c.telefono }) }
      })
    })

    setMailState({
      cot,
      contactos: contactosCot,
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
        cotizacion_id: mailState.cot.id,
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

  function onGuardada(cotizacion: Cotizacion) {
    setCotizaciones((prev) => {
      const idx = prev.findIndex((c) => c.id === cotizacion.id)
      if (idx >= 0) { const arr = [...prev]; arr[idx] = cotizacion; return arr }
      return [cotizacion, ...prev]
    })
    setModal({ open: false, cotizacion: null })
  }

  const puedeEditar = nivel <= 2
  const puedeEliminar = nivel <= 1
  const puedeVerGanancia = nivel <= 2

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtradas.length} cotización(es)</p>
        </div>
        {puedeEditar && (
          <button
            onClick={() => setModal({ open: true, cotizacion: null })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Nueva Cotización
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por ID o cliente..."
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        {['', ...ESTADOS].map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              filtroEstado === e
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {e === '' ? 'Todas' : e.charAt(0).toUpperCase() + e.slice(1)}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">
                <button
                  onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-1 hover:text-gray-800 transition-colors"
                  title="Ordenar por ID"
                >
                  ID
                  {sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                </button>
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Fecha</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Cliente</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Total</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">IVA</th>
              {puedeVerGanancia && (
                <th className="text-right px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Ganancia</th>
              )}
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Cliente de</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Elaborado por</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs uppercase">Estado</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={puedeVerGanancia ? 10 : 9} className="text-center py-12 text-gray-400">
                  No hay cotizaciones
                </td>
              </tr>
            )}
            {filtradas.map((cot) => {
              const cfg = estadoConfig[cot.estado] ?? estadoConfig.borrador
              const clienteNombre = (cot.cliente as { nombre: string } | undefined)?.nombre ?? '-'
              return (
                <tr key={cot.id} className={`${cfg.row} border-b border-gray-100`}>
                  <td className="px-3 py-2.5">
                    <span className="font-bold text-xs font-mono text-blue-700">{cot.folio}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{fmtDate(cot.fecha)}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[180px] truncate">{clienteNombre}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap">{fmt$(cot.total)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {cot.aplica_iva && cot.iva_monto > 0 ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-medium border border-yellow-200">{fmt$(cot.iva_monto)}</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  {puedeVerGanancia && (
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {cot.ganancia_total != null
                        ? <span className="font-semibold text-green-700">{fmt$(cot.ganancia_total)}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-xs text-gray-600">{cot.quien_es_el_cliente ?? 'Didara'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[140px] truncate">{cot.elaborado_por ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <select
                      value={cot.estado}
                      onChange={(e) => cambiarEstado(cot.id, e.target.value as EstadoCotizacion)}
                      className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${cfg.badge}`}
                    >
                      {ESTADOS.map((e) => (
                        <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setCotizacionVer(cotizacionVer?.id === cot.id ? null : cot)}
                        className={`p-1.5 rounded-lg transition-colors ${cotizacionVer?.id === cot.id ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title="Ver detalle"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => abrirPDF(cot.id)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Ver PDF en línea"
                      >
                        <ExternalLink size={13} />
                      </button>
                      {puedeEditar && (
                        <button
                          onClick={() => abrirMail(cot)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Enviar por correo"
                        >
                          <Mail size={13} />
                        </button>
                      )}
                      {puedeEditar && (
                        <button
                          onClick={() => setModal({ open: true, cotizacion: cot })}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {puedeEliminar && (
                        <button
                          onClick={() => eliminar(cot.id)}
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

      {/* Modal detalle cotización */}
      {cotizacionVer && (() => {
        const cot = cotizacionVer
        const cfg = estadoConfig[cot.estado] ?? estadoConfig.borrador
        const clienteObj = cot.cliente as { nombre: string; rfc?: string; uso_cfdi?: string } | undefined
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setCotizacionVer(null) }}>
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 w-full max-w-3xl my-6">
            {/* Encabezado */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-lg font-bold font-mono text-blue-700">{cot.folio}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                    {cot.estado.charAt(0).toUpperCase() + cot.estado.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{fmtDate(cot.fecha)}{cot.vigencia ? ` · Vigencia: ${fmtDate(cot.vigencia)}` : ''}</p>
              </div>
              <button onClick={() => setCotizacionVer(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Info general */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
              <div><span className="text-gray-500">Cliente:</span> <span className="font-medium text-gray-900">{clienteObj?.nombre ?? '-'}</span></div>
              <div><span className="text-gray-500">Elaborado por:</span> <span className="text-gray-700">{cot.elaborado_por ?? '—'}</span></div>
              {nivel <= 2 && clienteObj?.rfc && (
                <div><span className="text-gray-500">RFC:</span> <span className="text-gray-700">{clienteObj.rfc}</span></div>
              )}
              {nivel <= 2 && clienteObj?.uso_cfdi && (
                <div><span className="text-gray-500">Uso CFDI:</span> <span className="text-gray-700">{clienteObj.uso_cfdi}</span></div>
              )}
              {cot.quien_es_el_cliente && (
                <div><span className="text-gray-500">Cliente de:</span> <span className="text-gray-700">{cot.quien_es_el_cliente}</span></div>
              )}
              {cot.direccion_entrega && (
                <div className="col-span-2"><span className="text-gray-500">Dirección entrega:</span> <span className="text-gray-700">{cot.direccion_entrega}</span></div>
              )}
            </div>

            {/* Contactos */}
            {nivel <= 2 && cot.contactos_cotizacion && cot.contactos_cotizacion.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Contactos</p>
                <div className="flex flex-wrap gap-2">
                  {cot.contactos_cotizacion.map((c, i) => (
                    <div key={i} className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                      <p className="font-medium text-gray-800">{c.nombre}{c.puesto ? ` — ${c.puesto}` : ''}</p>
                      {c.telefono && <p className="text-gray-500">{c.telefono}</p>}
                      {c.email && <p className="text-gray-500">{c.email}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabla de ítems */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500 uppercase">Cant.</th>
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500 uppercase">Precio unit.</th>
                    {puedeVerGanancia && <th className="text-right px-2 py-1.5 font-medium text-gray-500 uppercase">Costo</th>}
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500 uppercase">Desc.</th>
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500 uppercase">Subtotal</th>
                    {puedeVerGanancia && <th className="text-right px-2 py-1.5 font-medium text-gray-500 uppercase">Ganancia</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(cot.items ?? []).map((item, i) => {
                    const gananciaItem = puedeVerGanancia && item.precio_compra != null
                      ? (item.precio_unitario - item.precio_compra) * (item.cantidad - (item.cantidad_recuperada ?? 0)) * (1 - item.descuento / 100)
                      : null
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-800">
                          <div>{item.descripcion}</div>
                          <div className="text-gray-400 capitalize">{item.tipo.replace('_', ' ')}</div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{item.cantidad}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{fmt$(item.precio_unitario)}</td>
                        {puedeVerGanancia && (
                          <td className="px-2 py-1.5 text-right text-gray-500">{item.precio_compra != null ? fmt$(item.precio_compra) : '—'}</td>
                        )}
                        <td className="px-2 py-1.5 text-right text-gray-500">{item.descuento > 0 ? `${item.descuento}%` : '—'}</td>
                        <td className="px-2 py-1.5 text-right font-medium text-gray-900">{fmt$(item.subtotal)}</td>
                        {puedeVerGanancia && (
                          <td className="px-2 py-1.5 text-right text-green-700 font-medium">{gananciaItem != null ? fmt$(gananciaItem) : '—'}</td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt$(cot.subtotal)}</span></div>
                {cot.aplica_iva && (
                  <div className="flex justify-between text-gray-600"><span>IVA ({cot.iva_porcentaje}%)</span><span>{fmt$(cot.iva_monto)}</span></div>
                )}
                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1"><span>Total</span><span>{fmt$(cot.total)}</span></div>
                {puedeVerGanancia && cot.ganancia_total != null && (
                  <div className="flex justify-between text-green-700 font-semibold"><span>Ganancia</span><span>{fmt$(cot.ganancia_total)}</span></div>
                )}
              </div>
            </div>

            {/* Notas */}
            {cot.notas && (
              <div className="text-sm text-gray-600 border-t border-gray-100 pt-3">
                <span className="font-medium text-gray-700">Notas: </span>{cot.notas}
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
                <h2 className="text-base font-semibold text-gray-900">Enviar cotización {mailState.cot.folio}</h2>
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
                    <span className="text-sm text-gray-700">Adjuntar PDF de la cotización</span>
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
        <CotizacionModal
          cotizacion={modal.cotizacion}
          clientes={clientes}
          productos={productos}
          ivaDefault={ivaDefault}
          onClose={() => setModal({ open: false, cotizacion: null })}
          onGuardada={onGuardada}
        />
      )}
    </div>
  )
}

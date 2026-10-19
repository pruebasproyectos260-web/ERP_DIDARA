'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ExternalLink, Eye, Mail, Loader2, X, BadgeCheck, Copy, Check, MessageCircle, Wrench, Signature } from 'lucide-react'
import type { Reporte } from '@/types'
import ReporteModal from './ReporteModal'
import { borrar } from '@/lib/api-cliente'
import { BotonIcono, BotonPrincipal, Buscador, EncabezadoPagina, EstadoVacio, Segmentado } from '@/components/ui/Pagina'
import { aviso, confirmar } from '@/components/ui/Avisos'

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
  /** Ticket de la mesa de ayuda desde el que se crea un reporte (/reportes?ticket=ID) */
  ticketOrigen?: { id: number; folio: string; cliente_id: number; asunto: string; descripcion: string } | null
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

const ESTADOS_REPORTE = ['abierto', 'en_proceso', 'completado', 'entregado', 'cancelado']

function etiquetaEstado(e: string) {
  const t = e.replace('_', ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function fmt$(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
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

export default function ReportesClient({ reportes: inicial, clientes, tecnicos, nivel, ticketOrigen = null }: Props) {
  const router = useRouter()
  const [reportes, setReportes] = useState<Reporte[]>(inicial)
  // Si se llegó desde un ticket (/reportes?ticket=ID), el formulario abre ya precargado
  const [modal, setModal] = useState<{ open: boolean; reporte: Reporte | null }>({
    open: !!ticketOrigen, reporte: null,
  })
  const [ticketPendiente, setTicketPendiente] = useState(ticketOrigen)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [verDetalle, setVerDetalle] = useState<Reporte | null>(null)
  const [mailState, setMailState] = useState<MailRepState | null>(null)
  const [firmaLink, setFirmaLink] = useState<{ rep: Reporte; url: string; copiado: boolean } | null>(null)
  const [generandoFirma, setGenerandoFirma] = useState<number | null>(null)

  const filtrados = reportes.filter((r) => {
    const matchEstado = !filtroEstado || r.estado === filtroEstado
    const q = busqueda.toLowerCase()
    const cliente = (r.cliente as { nombre: string } | undefined)?.nombre ?? ''
    const matchQ = !q || r.folio.toLowerCase().includes(q) || cliente.toLowerCase().includes(q) || r.equipo.toLowerCase().includes(q)
    return matchEstado && matchQ
  }).sort((a, b) => b.id - a.id)

  async function eliminar(id: number) {
    if (!(await confirmar({ titulo: '¿Eliminar este reporte?', mensaje: 'Esta acción no se puede deshacer.', peligro: true }))) return
    if (!(await borrar(`/api/reportes/${id}`, 'No se pudo eliminar el reporte'))) return
    setReportes((prev) => prev.filter((r) => r.id !== id))
    if (verDetalle?.id === id) setVerDetalle(null)
  }

  async function abrirFirma(r: Reporte) {
    setGenerandoFirma(r.id)
    try {
      const res = await fetch(`/api/reportes/${r.id}/firma-link`)
      const json = await res.json()
      if (!res.ok) return aviso.error(json.error ?? 'No se pudo generar el enlace de firma')
      const url = `${window.location.origin}/firma-cliente?id=${r.id}&t=${json.data.token}`
      setFirmaLink({ rep: r, url, copiado: false })
    } catch {
      aviso.error('Error de red. Intenta de nuevo.')
    } finally {
      setGenerandoFirma(null)
    }
  }

  async function copiarFirma() {
    if (!firmaLink) return
    try {
      await navigator.clipboard.writeText(firmaLink.url)
      setFirmaLink({ ...firmaLink, copiado: true })
      aviso.exito('Enlace copiado')
    } catch {
      aviso.info('No se pudo copiar automáticamente: selecciona el enlace y cópialo')
    }
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
      if (next.has(email)) next.delete(email)
      else next.add(email)
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
    aviso.exito(`Reporte ${reporte.folio} guardado`)

    // Reporte creado desde un ticket: se liga al ticket y el ticket pasa a "en proceso"
    if (ticketPendiente) {
      const ticket = ticketPendiente
      setTicketPendiente(null)
      fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reporte_id: reporte.id, estado: 'en_proceso' }),
      })
        .then((r) => {
          if (r.ok) aviso.info(`Ligado al ticket ${ticket.folio}`)
          else aviso.error(`El reporte se guardó, pero no se pudo ligar al ticket ${ticket.folio}`)
        })
        .catch(() => aviso.error(`El reporte se guardó, pero no se pudo ligar al ticket ${ticket.folio}`))
      router.replace('/reportes')
    }
  }

  function cerrarModal() {
    setModal({ open: false, reporte: null })
    if (ticketPendiente) {
      setTicketPendiente(null)
      router.replace('/reportes')
    }
  }

  const puedeEditar  = nivel <= 2
  const puedeEliminar = nivel <= 1

  const conteoEstado = reportes.reduce<Record<string, number>>((acc, r) => {
    acc[r.estado] = (acc[r.estado] ?? 0) + 1
    return acc
  }, {})
  const opcionesEstado = [
    { value: '', label: `Todos ${reportes.length}` },
    ...ESTADOS_REPORTE.filter((e) => conteoEstado[e]).map((e) => ({ value: e, label: `${etiquetaEstado(e)} ${conteoEstado[e]}` })),
  ]

  // Acciones de cada reporte (se usan en la tabla y en las tarjetas)
  function acciones(r: Reporte, tam: number) {
    return (
      <>
        <BotonIcono titulo="Ver detalle" tono="marca" onClick={() => setVerDetalle(r)}><Eye size={tam} /></BotonIcono>
        <BotonIcono titulo="Ver PDF" tono="exito" onClick={() => abrirPDF(r.id)}><ExternalLink size={tam} /></BotonIcono>
        {puedeEditar && <BotonIcono titulo="Enviar por correo" tono="marca" onClick={() => abrirMail(r)}><Mail size={tam} /></BotonIcono>}
        {r.firma_fecha ? (
          <span className="p-2 text-purple-600"
            title={`Firmado por el cliente el ${new Date(r.firma_fecha).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`}>
            <BadgeCheck size={tam} />
          </span>
        ) : puedeEditar && (
          <BotonIcono titulo="Enlace de firma para el cliente" tono="violeta" onClick={() => abrirFirma(r)} disabled={generandoFirma === r.id}>
            {generandoFirma === r.id ? <Loader2 size={tam} className="animate-spin" /> : <Signature size={tam} />}
          </BotonIcono>
        )}
        {puedeEditar && <BotonIcono titulo="Editar" tono="marca" onClick={() => setModal({ open: true, reporte: r })}><Pencil size={tam} /></BotonIcono>}
        {puedeEliminar && <BotonIcono titulo="Eliminar" tono="peligro" onClick={() => eliminar(r.id)}><Trash2 size={tam} /></BotonIcono>}
      </>
    )
  }

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Reportes de servicio"
        subtitulo={`${filtrados.length} de ${reportes.length} reportes`}
        acciones={puedeEditar && (
          <BotonPrincipal onClick={() => setModal({ open: true, reporte: null })}>
            <Plus size={17} /> <span>Nuevo reporte</span>
          </BotonPrincipal>
        )}
      />

      {/* Filtros */}
      <div className="space-y-3">
        <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por folio, cliente o equipo…" />
        <Segmentado opciones={opcionesEstado} valor={filtroEstado} onCambio={setFiltroEstado} />
      </div>

      {filtrados.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<Wrench size={22} />} titulo={busqueda || filtroEstado ? 'Sin resultados' : 'No hay reportes aún'}
            descripcion={busqueda || filtroEstado ? 'Prueba con otra búsqueda o quita el filtro de estado.' : 'Crea el primero con el botón “Nuevo reporte”.'} />
        </div>
      )}

      {/* Celular y tableta: tarjetas */}
      <div className="space-y-3 lg:hidden">
        {filtrados.map((r) => {
          const cliente = (r.cliente as { nombre: string } | undefined)?.nombre ?? '—'
          const tecnico = (r.tecnico as { nombre: string } | undefined)?.nombre ?? '—'
          const equipoStr = [r.equipo, r.marca, r.modelo].filter(Boolean).join(' · ')
          return (
            <article key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm shadow-black/[0.02]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-brand-700">{r.folio}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${estadoConfig[r.estado] ?? estadoConfig.abierto}`}>
                      {etiquetaEstado(r.estado)}
                    </span>
                  </div>
                  <h3 className="mt-1 truncate font-semibold text-gray-900">{cliente}</h3>
                  <p className="truncate text-xs text-gray-500">{equipoStr}</p>
                </div>
                <p className="shrink-0 text-lg font-semibold tracking-tight text-gray-900">{fmt$(Number(r.total))}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-gray-500">
                <span>{formatDate(r.fecha_ingreso)}{r.fecha_entrega ? ` → ${formatDate(r.fecha_entrega)}` : ''}</span>
                <span>Técnico: {tecnico}</span>
              </div>
              <div className="-mr-2 mt-2 flex items-center justify-end border-t border-gray-100 pt-2">
                {acciones(r, 17)}
              </div>
            </article>
          )
        })}
      </div>

      {/* Escritorio: tabla */}
      <div className={`hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02] ${filtrados.length ? 'lg:block' : ''}`}>
        <table className="w-full text-sm">
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
                    <span className="font-bold text-xs font-mono text-brand-700">{r.folio}</span>
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
                      {etiquetaEstado(r.estado)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {fmt$(Number(r.total))}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end">{acciones(r, 15)}</div>
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
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 animate-aparecer sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setVerDetalle(null) }}
          >
            <div className="my-2 w-full max-w-2xl space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl animate-subir sm:my-6 sm:p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold font-mono text-brand-700">{r.folio}</span>
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-aparecer sm:items-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full animate-subir max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-brand-600" />
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
                          <label key={c.email} className="flex items-start gap-2.5 p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-brand-50 hover:border-brand-200 transition-colors">
                            <input type="checkbox" checked={mailState.selected.has(c.email)} onChange={() => toggleEmail(c.email)} className="mt-0.5 rounded" />
                            <span>
                              <span className="text-sm font-medium text-gray-800">{c.nombre}</span>
                              {c.cargo && <span className="text-xs text-gray-400 ml-1.5">{c.cargo}</span>}
                              <br />
                              <span className="text-xs text-brand-600">{c.email}</span>
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
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
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
                  {mailState.enviando ? <><Loader2 size={14} className="animate-spin" />Enviando...</> : <><Mail size={14} />Enviar</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal enlace de firma */}
      {firmaLink && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-aparecer sm:items-center sm:p-4" onClick={() => setFirmaLink(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full animate-subir max-h-[92dvh] overflow-y-auto max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Signature size={16} className="text-purple-600" />
                <h3 className="font-semibold text-gray-900">Firma del cliente — {firmaLink.rep.folio}</h3>
              </div>
              <button onClick={() => setFirmaLink(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Envía este enlace al cliente. Al firmar, el reporte se marca como <strong>entregado</strong> y la firma aparece en el PDF.
              </p>
              <input readOnly value={firmaLink.url} onFocus={(e) => e.target.select()}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 bg-gray-50" />
              <div className="flex gap-2">
                <button onClick={copiarFirma}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
                  {firmaLink.copiado ? <><Check size={14} />Copiado</> : <><Copy size={14} />Copiar enlace</>}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Hola, por favor firma de conformidad el reporte ${firmaLink.rep.folio} de Didara TI: ${firmaLink.url}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                  <MessageCircle size={14} />WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal.open && (
        <ReporteModal
          reporte={modal.reporte}
          clientes={clientes}
          tecnicos={tecnicos}
          onClose={cerrarModal}
          onGuardado={onGuardado}
          iniciales={!modal.reporte && ticketPendiente ? {
            cliente_id: ticketPendiente.cliente_id,
            falla_reportada: `${ticketPendiente.asunto}\n${ticketPendiente.descripcion}\n(Ticket ${ticketPendiente.folio})`,
          } : undefined}
        />
      )}
    </div>
  )
}

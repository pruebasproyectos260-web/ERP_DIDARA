'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus, LifeBuoy, X, Loader2, Send, Phone, Mail, MessageCircle, Wrench, Trash2, Lock,
  Globe, Smartphone, PhoneCall, AtSign, UserRound, RefreshCw, ExternalLink,
} from 'lucide-react'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { borrar } from '@/lib/api-cliente'
import { BotonIcono, BotonPrincipal, Buscador, EncabezadoPagina, EstadoVacio, Segmentado } from '@/components/ui/Pagina'
import PortalCliente from '@/components/ui/PortalCliente'
import BotonAvisos from '@/components/ui/BotonAvisos'
import { avisarCambioTickets } from '@/components/layout/useNovedadesTickets'
import {
  CATEGORIAS_TICKET, ESTADOS_CERRADOS, ESTADOS_TICKET, ETIQUETA_CATEGORIA, ETIQUETA_ESTADO,
  ETIQUETA_ORIGEN, ETIQUETA_PRIORIDAD, ORIGENES_TICKET, PRIORIDADES_TICKET,
  type EstadoTicket, type PrioridadTicket,
} from '@/lib/tickets'

interface Ticket {
  id: number
  folio: string
  cliente_id: number | null
  cliente_nombre: string | null
  cliente?: { id: number; nombre: string } | null
  contacto_nombre: string | null
  contacto_email: string | null
  contacto_telefono: string | null
  asunto: string
  descripcion: string
  categoria: string
  prioridad: PrioridadTicket
  estado: EstadoTicket
  origen: string
  asignado_a: string | null
  reporte_id: number | null
  created_at: string
  updated_at: string
}
interface Comentario { id: number; autor_nombre: string; mensaje: string; visible_cliente: boolean; es_sistema: boolean; created_at: string }
interface Detalle extends Ticket { comentarios: Comentario[]; reporte: { id: number; folio: string; estado: string } | null }

interface Props {
  ticketsIniciales: Ticket[]
  usuarios: { id: string; nombre: string }[]
  clientes: { id: number; nombre: string; email: string | null }[]
  nivel: number
  userId: string
  verInicial: number | null
}

const COLOR_ESTADO: Record<EstadoTicket, string> = {
  abierto: 'bg-blue-100 text-blue-700',
  en_proceso: 'bg-amber-100 text-amber-800',
  en_espera: 'bg-purple-100 text-purple-700',
  resuelto: 'bg-green-100 text-green-700',
  cerrado: 'bg-gray-100 text-gray-600',
}
const COLOR_PRIORIDAD: Record<PrioridadTicket, string> = {
  baja: 'bg-gray-300', media: 'bg-brand-400', alta: 'bg-orange-400', urgente: 'bg-red-500',
}
const ICONO_ORIGEN: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  portal: Globe, whatsapp: Smartphone, telefono: PhoneCall, correo: AtSign, interno: UserRound,
}

const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'

type Filtro = 'activos' | EstadoTicket | 'todos'

function haceCuanto(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 30) return `hace ${d} d`
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const iniciales = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
const nombreCliente = (t: Ticket) => t.cliente?.nombre ?? t.cliente_nombre ?? 'Sin cliente'

export default function TicketsClient({ ticketsIniciales, usuarios, clientes, nivel, userId, verInicial }: Props) {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>(ticketsIniciales)
  const [filtro, setFiltro] = useState<Filtro>('activos')
  const [soloMios, setSoloMios] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [abiertoId, setAbiertoId] = useState<number | null>(verInicial)
  // ?ver=ID puede cambiar sin recargar (aviso "Ver ticket", notificación push): abrir ese ticket
  const ver = Number(useSearchParams().get('ver')) || null
  const [verPrevio, setVerPrevio] = useState(ver)
  if (ver !== verPrevio) {
    setVerPrevio(ver)
    if (ver) setAbiertoId(ver)
  }
  const [nuevo, setNuevo] = useState(false)
  const [portalDe, setPortalDe] = useState<{ id: number; email: string | null } | null>(null)

  const puedeEditar = nivel <= 2
  const nombreUsuario = useMemo(() => Object.fromEntries(usuarios.map((u) => [u.id, u.nombre])), [usuarios])

  const conteo = useMemo(() => {
    const c: Record<string, number> = { todos: tickets.length, activos: 0 }
    for (const t of tickets) {
      c[t.estado] = (c[t.estado] ?? 0) + 1
      if (!ESTADOS_CERRADOS.includes(t.estado)) c.activos++
    }
    return c
  }, [tickets])
  const urgentes = tickets.filter((t) => t.prioridad === 'urgente' && !ESTADOS_CERRADOS.includes(t.estado)).length

  const filtrados = tickets.filter((t) => {
    if (filtro === 'activos' && ESTADOS_CERRADOS.includes(t.estado)) return false
    if (filtro !== 'activos' && filtro !== 'todos' && t.estado !== filtro) return false
    if (soloMios && t.asignado_a !== userId) return false
    const q = busqueda.trim().toLowerCase()
    return !q || t.folio.toLowerCase().includes(q) || t.asunto.toLowerCase().includes(q) || nombreCliente(t).toLowerCase().includes(q)
  })

  const opcionesFiltro: { value: Filtro; label: string }[] = [
    { value: 'activos', label: `Activos ${conteo.activos}` },
    ...ESTADOS_TICKET.filter((e) => conteo[e]).map((e) => ({ value: e as Filtro, label: `${ETIQUETA_ESTADO[e]} ${conteo[e]}` })),
    { value: 'todos', label: `Todos ${conteo.todos}` },
  ]

  function actualizarEnLista(t: Ticket) {
    setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...t } : x)))
    avisarCambioTickets()
  }

  const recargarLista = useCallback(async () => {
    const r = await fetch('/api/tickets').catch(() => null)
    if (!r?.ok) return
    const { data } = await r.json()
    if (Array.isArray(data)) setTickets(data)
  }, [])

  // Llegó un ticket o una respuesta (ver useNovedadesTickets): se actualiza la lista sin recargar
  useEffect(() => {
    const alLlegar = () => { void recargarLista() }
    window.addEventListener('tickets:novedades', alLlegar)
    return () => window.removeEventListener('tickets:novedades', alLlegar)
  }, [recargarLista])

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Mesa de ayuda"
        subtitulo={<>
          {conteo.activos} en atención
          {urgentes > 0 && <span className="ml-2 font-medium text-red-600">· {urgentes} urgente{urgentes === 1 ? '' : 's'}</span>}
        </>}
        acciones={<>
          <BotonIcono titulo="Actualizar" onClick={recargarLista} className="border border-gray-200 bg-white !p-2.5">
            <RefreshCw size={16} />
          </BotonIcono>
          <BotonAvisos />
          {puedeEditar && (
            <BotonPrincipal onClick={() => setNuevo(true)}>
              <Plus size={17} /> <span>Nuevo ticket</span>
            </BotonPrincipal>
          )}
        </>}
      />

      <div className="space-y-3">
        <div className="flex gap-2">
          <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por folio, asunto o cliente…" className="flex-1" />
          <button onClick={() => setSoloMios((v) => !v)} aria-pressed={soloMios}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition-colors ${
              soloMios ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
            <UserRound size={15} /><span className="hidden sm:inline">Asignados a mí</span><span className="sm:hidden">Míos</span>
          </button>
        </div>
        <Segmentado opciones={opcionesFiltro} valor={filtro} onCambio={setFiltro} />
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<LifeBuoy size={22} />}
            titulo={tickets.length === 0 ? 'Aún no hay tickets' : 'Sin tickets en esta vista'}
            descripcion={tickets.length === 0
              ? 'Registra los que lleguen por WhatsApp o teléfono, o comparte el portal de soporte con tus clientes desde Clientes.'
              : 'Prueba con otro filtro o búsqueda.'} />
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02]">
          {filtrados.map((t) => {
            const Origen = ICONO_ORIGEN[t.origen] ?? Globe
            const asignado = t.asignado_a ? nombreUsuario[t.asignado_a] : null
            return (
              <li key={t.id} className="border-b border-gray-100 last:border-0">
                <button onClick={() => setAbiertoId(t.id)}
                  className="relative flex w-full items-start gap-3 py-3.5 pl-5 pr-4 text-left transition-colors hover:bg-gray-50">
                  <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${COLOR_PRIORIDAD[t.prioridad]}`} title={`Prioridad ${ETIQUETA_PRIORIDAD[t.prioridad]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs font-semibold text-brand-700">{t.folio}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${COLOR_ESTADO[t.estado]}`}>{ETIQUETA_ESTADO[t.estado]}</span>
                      {t.prioridad === 'urgente' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Urgente</span>}
                      {t.prioridad === 'alta' && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">Alta</span>}
                    </div>
                    <p className="mt-1 truncate font-medium text-gray-900">{t.asunto}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-500">
                      <Origen size={12} className="shrink-0" />
                      <span className="truncate">{nombreCliente(t)}{t.contacto_nombre ? ` · ${t.contacto_nombre}` : ''}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-xs text-gray-400">{haceCuanto(t.created_at)}</span>
                    {asignado
                      ? <span title={`Asignado a ${asignado}`} className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">{iniciales(asignado)}</span>
                      : !ESTADOS_CERRADOS.includes(t.estado) && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Sin asignar</span>}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {abiertoId !== null && (
        <DetalleTicket
          id={abiertoId}
          usuarios={usuarios}
          puedeEditar={puedeEditar}
          puedeEliminar={nivel <= 1}
          onCerrar={() => { setAbiertoId(null); if (ver) router.replace('/tickets') }}
          onActualizado={actualizarEnLista}
          onEliminado={(id) => { setTickets((p) => p.filter((x) => x.id !== id)); setAbiertoId(null); avisarCambioTickets() }}
          onPortal={(clienteId) => setPortalDe({ id: clienteId, email: clientes.find((c) => c.id === clienteId)?.email ?? null })}
        />
      )}

      {nuevo && (
        <NuevoTicket usuarios={usuarios} clientes={clientes} onCerrar={() => setNuevo(false)}
          onCreado={(t) => { setTickets((p) => [t, ...p]); setNuevo(false); setAbiertoId(t.id); aviso.exito(`Ticket ${t.folio} registrado`); avisarCambioTickets() }} />
      )}

      {portalDe && <PortalCliente clienteId={portalDe.id} emailSugerido={portalDe.email} onCerrar={() => setPortalDe(null)} />}
    </div>
  )
}

// ── Detalle (panel lateral en escritorio, hoja completa en celular) ─────────

function DetalleTicket({ id, usuarios, puedeEditar, puedeEliminar, onCerrar, onActualizado, onEliminado, onPortal }: {
  id: number
  usuarios: { id: string; nombre: string }[]
  puedeEditar: boolean
  puedeEliminar: boolean
  onCerrar: () => void
  onActualizado: (t: Ticket) => void
  onEliminado: (id: number) => void
  onPortal: (clienteId: number) => void
}) {
  const router = useRouter()
  const [t, setT] = useState<Detalle | null>(null)
  const [error, setError] = useState('')
  const [recarga, setRecarga] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [interna, setInterna] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/tickets/${id}`)
      .then(async (r) => {
        const j = await r.json()
        if (cancelado) return
        if (!r.ok) setError(j.error ?? 'No se pudo cargar el ticket')
        else setT(j.data)
      })
      .catch(() => { if (!cancelado) setError('Error de red') })
    return () => { cancelado = true }
  }, [id, recarga])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  // El cliente respondió en este ticket mientras está abierto: se recarga el seguimiento
  useEffect(() => {
    const alLlegar = (e: Event) => {
      if ((e as CustomEvent<{ ids: number[] }>).detail?.ids?.includes(id)) setRecarga((n) => n + 1)
    }
    window.addEventListener('tickets:novedades', alLlegar)
    return () => window.removeEventListener('tickets:novedades', alLlegar)
  }, [id])

  async function cambiar(cambios: Partial<Pick<Ticket, 'estado' | 'prioridad' | 'asignado_a' | 'categoria'>>) {
    if (!t) return
    setGuardando(true)
    try {
      const r = await fetch(`/api/tickets/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios) })
      const j = await r.json()
      if (!r.ok) return aviso.error(j.error ?? 'No se pudo actualizar el ticket')
      onActualizado(j.data)
      if (cambios.estado === 'resuelto' && t.contacto_email) aviso.exito('Ticket resuelto · se avisó al cliente por correo')
      setRecarga((n) => n + 1)
    } catch {
      aviso.error('Error de red')
    } finally {
      setGuardando(false)
    }
  }

  async function comentar(e: React.FormEvent) {
    e.preventDefault()
    if (!t || !mensaje.trim()) return
    setEnviando(true)
    try {
      const r = await fetch(`/api/tickets/${t.id}/comentarios`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje, visible_cliente: !interna }),
      })
      const j = await r.json()
      if (!r.ok) return aviso.error(j.error ?? 'No se pudo enviar')
      setMensaje('')
      setT((prev) => prev && { ...prev, comentarios: [...prev.comentarios, j.data] })
    } catch {
      aviso.error('Error de red')
    } finally {
      setEnviando(false)
    }
  }

  async function eliminar() {
    if (!t) return
    if (!(await confirmar({ titulo: `¿Eliminar el ticket ${t.folio}?`, mensaje: 'Se borra también su seguimiento. Esta acción no se puede deshacer.', peligro: true }))) return
    if (await borrar(`/api/tickets/${t.id}`, 'No se pudo eliminar el ticket')) onEliminado(t.id)
  }

  const telefonoWa = t?.contacto_telefono?.replace(/\D/g, '')

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-aparecer" onMouseDown={onCerrar}>
      <aside onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Detalle del ticket"
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl animate-entrar-derecha sm:rounded-l-2xl">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          {t ? (
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-brand-700">{t.folio}</span>
                <span className="text-xs text-gray-400">{fechaHora(t.created_at)} · {ETIQUETA_ORIGEN[t.origen as keyof typeof ETIQUETA_ORIGEN] ?? t.origen}</span>
              </div>
              <h2 className="mt-1 text-lg font-semibold leading-snug text-gray-900">{t.asunto}</h2>
              <p className="text-sm text-gray-500">{nombreCliente(t)}</p>
            </div>
          ) : <div className="h-14" />}
          <div className="-mr-2 flex shrink-0">
            {t && puedeEliminar && <BotonIcono titulo="Eliminar ticket" tono="peligro" onClick={eliminar}><Trash2 size={17} /></BotonIcono>}
            <BotonIcono titulo="Cerrar" onClick={onCerrar}><X size={19} /></BotonIcono>
          </div>
        </div>

        {error ? <p className="p-5 text-sm text-red-600">{error}</p> : !t ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Controles */}
            <div className="grid grid-cols-2 gap-3 border-b border-gray-100 px-5 py-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">Estado</span>
                <select disabled={!puedeEditar || guardando} value={t.estado} onChange={(e) => cambiar({ estado: e.target.value as EstadoTicket })}
                  className={`w-full rounded-lg border-0 px-2.5 py-2 text-sm font-semibold ${COLOR_ESTADO[t.estado]}`}>
                  {ESTADOS_TICKET.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">Prioridad</span>
                <select disabled={!puedeEditar || guardando} value={t.prioridad} onChange={(e) => cambiar({ prioridad: e.target.value as PrioridadTicket })}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm">
                  {PRIORIDADES_TICKET.map((p) => <option key={p} value={p}>{ETIQUETA_PRIORIDAD[p]}</option>)}
                </select>
              </label>
              <label className="col-span-2 block sm:col-span-1">
                <span className="mb-1 block text-xs font-medium text-gray-500">Asignado a</span>
                <select disabled={!puedeEditar || guardando} value={t.asignado_a ?? ''} onChange={(e) => cambiar({ asignado_a: e.target.value || null })}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm">
                  <option value="">Sin asignar</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </label>
            </div>

            {/* Contacto y acciones */}
            <div className="space-y-3 border-b border-gray-100 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-500">Contacto:</span>
                <span className="font-medium text-gray-900">{t.contacto_nombre ?? '—'}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{ETIQUETA_CATEGORIA[t.categoria as keyof typeof ETIQUETA_CATEGORIA] ?? t.categoria}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {t.contacto_telefono && (
                  <a href={`tel:${t.contacto_telefono.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100">
                    <Phone size={13} /> {t.contacto_telefono}
                  </a>
                )}
                {telefonoWa && telefonoWa.length >= 10 && (
                  <a href={`https://wa.me/${telefonoWa.length === 10 ? `52${telefonoWa}` : telefonoWa}?text=${encodeURIComponent(`Hola, te escribimos de Didara TI sobre tu ticket ${t.folio}: ${t.asunto}`)}`}
                    target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                )}
                {t.contacto_email && (
                  <a href={`mailto:${t.contacto_email}?subject=${encodeURIComponent(`Ticket ${t.folio}: ${t.asunto}`)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100">
                    <Mail size={13} /> {t.contacto_email}
                  </a>
                )}
                {t.cliente_id && (
                  <button onClick={() => onPortal(t.cliente_id!)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <LifeBuoy size={13} /> Portal del cliente
                  </button>
                )}
              </div>
              {t.reporte ? (
                <a href={`/api/pdf/reporte/${t.reporte.id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                  <Wrench size={15} className="text-brand-600" />
                  Reporte de servicio <span className="font-mono font-semibold text-brand-700">{t.reporte.folio}</span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">{t.reporte.estado.replace('_', ' ')} <ExternalLink size={12} /></span>
                </a>
              ) : puedeEditar && !ESTADOS_CERRADOS.includes(t.estado) && t.cliente_id && (
                <button onClick={() => router.push(`/reportes?ticket=${t.id}`)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50">
                  <Wrench size={15} /> Crear reporte de servicio
                </button>
              )}
            </div>

            {/* Descripción y seguimiento */}
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3.5 text-sm text-gray-800">{t.descripcion}</p>
              <ol className="mt-5 space-y-4">
                {t.comentarios.map((c) => (
                  c.es_sistema ? (
                    <li key={c.id} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="h-px flex-1 bg-gray-200" />
                      <span className="text-center">{c.mensaje} · {c.autor_nombre} · {fechaHora(c.created_at)}</span>
                      <span className="h-px flex-1 bg-gray-200" />
                    </li>
                  ) : (
                    <li key={c.id} className={`rounded-xl p-3 ${c.visible_cliente ? 'border border-gray-200 bg-white' : 'border border-amber-200 bg-amber-50'}`}>
                      <p className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="font-medium text-gray-800">{c.autor_nombre}</span> · {fechaHora(c.created_at)}
                        {!c.visible_cliente && <span className="ml-auto inline-flex items-center gap-1 font-medium text-amber-700"><Lock size={11} /> Nota interna</span>}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{c.mensaje}</p>
                    </li>
                  )
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Responder */}
        {t && puedeEditar && (
          <form onSubmit={comentar} className="border-t border-gray-200 px-5 py-3">
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2} maxLength={3000}
              placeholder={interna ? 'Nota interna (el cliente no la ve)…' : 'Responder al cliente…'}
              className={`${inputCls} resize-none ${interna ? 'border-amber-300 bg-amber-50' : ''}`} />
            <div className="mt-2 flex items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={interna} onChange={(e) => setInterna(e.target.checked)} className="rounded" />
                Nota interna
              </label>
              <button type="submit" disabled={enviando || !mensaje.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Enviar
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  )
}

// ── Registrar ticket (llegó por WhatsApp, teléfono, correo…) ───────────────

function NuevoTicket({ usuarios, clientes, onCerrar, onCreado }: {
  usuarios: { id: string; nombre: string }[]
  clientes: { id: number; nombre: string }[]
  onCerrar: () => void
  onCreado: (t: Ticket) => void
}) {
  const [form, setForm] = useState({
    cliente_id: '', cliente_nombre: '', contacto_nombre: '', contacto_email: '', contacto_telefono: '',
    origen: 'whatsapp', categoria: 'soporte', prioridad: 'media', asunto: '', descripcion: '', asignado_a: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const otroCliente = form.cliente_id === 'otro'

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setGuardando(true)
    try {
      const r = await fetch('/api/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          cliente_id: form.cliente_id && !otroCliente ? Number(form.cliente_id) : null,
          cliente_nombre: otroCliente ? form.cliente_nombre : null,
          asignado_a: form.asignado_a || null,
        }),
      })
      const j = await r.json()
      if (!r.ok) return setError(j.error ?? 'No se pudo registrar el ticket')
      onCreado(j.data)
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-aparecer sm:items-center sm:p-4" onMouseDown={onCerrar}>
      <form onSubmit={guardar} onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-2xl animate-subir sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Registrar ticket</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Cliente *</span>
              <select required value={form.cliente_id} onChange={(e) => set('cliente_id', e.target.value)} className={inputCls}>
                <option value="">Selecciona…</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                <option value="otro">— No está registrado —</option>
              </select>
            </label>
            {otroCliente ? (
              <label className="block">
                <span className="label">Nombre del cliente *</span>
                <input required value={form.cliente_nombre} onChange={(e) => set('cliente_nombre', e.target.value)} className={inputCls} />
              </label>
            ) : (
              <label className="block">
                <span className="label">¿Cómo llegó?</span>
                <select value={form.origen} onChange={(e) => set('origen', e.target.value)} className={inputCls}>
                  {ORIGENES_TICKET.filter((o) => o !== 'portal').map((o) => <option key={o} value={o}>{ETIQUETA_ORIGEN[o]}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="label">Contacto</span>
              <input value={form.contacto_nombre} onChange={(e) => set('contacto_nombre', e.target.value)} className={inputCls} placeholder="Quién reporta" />
            </label>
            <label className="block">
              <span className="label">Teléfono</span>
              <input type="tel" value={form.contacto_telefono} onChange={(e) => set('contacto_telefono', e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="label">Correo</span>
              <input type="email" value={form.contacto_email} onChange={(e) => set('contacto_email', e.target.value)} className={inputCls} placeholder="Para avisarle al resolver" />
            </label>
          </div>

          <label className="block">
            <span className="label">Asunto *</span>
            <input required maxLength={150} value={form.asunto} onChange={(e) => set('asunto', e.target.value)} className={inputCls} placeholder="Ej. Sin internet en oficina" />
          </label>
          <label className="block">
            <span className="label">Descripción *</span>
            <textarea required rows={4} maxLength={5000} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} className={`${inputCls} resize-y`} />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="label">Categoría</span>
              <select value={form.categoria} onChange={(e) => set('categoria', e.target.value)} className={inputCls}>
                {CATEGORIAS_TICKET.map((c) => <option key={c} value={c}>{ETIQUETA_CATEGORIA[c]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Prioridad</span>
              <select value={form.prioridad} onChange={(e) => set('prioridad', e.target.value)} className={inputCls}>
                {PRIORIDADES_TICKET.map((p) => <option key={p} value={p}>{ETIQUETA_PRIORIDAD[p]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Asignar a</span>
              <select value={form.asignado_a} onChange={(e) => set('asignado_a', e.target.value)} className={inputCls}>
                <option value="">Sin asignar</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </label>
          </div>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-5 py-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button type="submit" disabled={guardando}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {guardando && <Loader2 size={16} className="animate-spin" />} Registrar ticket
          </button>
        </div>
      </form>
    </div>
  )
}

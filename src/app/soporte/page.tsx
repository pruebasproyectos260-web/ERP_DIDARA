'use client'

import { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, ChevronDown, Loader2, MessageSquarePlus, Plus, Send, X } from 'lucide-react'
import { aviso } from '@/components/ui/Avisos'
import { CATEGORIAS_TICKET, ESTADOS_CERRADOS, ETIQUETA_CATEGORIA, ETIQUETA_ESTADO, type EstadoTicket } from '@/lib/tickets'

// Portal de soporte del cliente (público, sin cuenta). Entra con su enlace /soporte?c=<id>&t=<token>.

interface Comentario { autor_nombre: string; mensaje: string; es_sistema: boolean; created_at: string }
interface TicketPortal {
  folio: string; asunto: string; descripcion: string; categoria: string; prioridad: string
  estado: EstadoTicket; contacto_nombre: string | null; created_at: string; updated_at: string
  comentarios: Comentario[]
}

const COLOR_ESTADO: Record<EstadoTicket, string> = {
  abierto: 'bg-blue-100 text-blue-700',
  en_proceso: 'bg-amber-100 text-amber-800',
  en_espera: 'bg-purple-100 text-purple-700',
  resuelto: 'bg-green-100 text-green-700',
  cerrado: 'bg-gray-100 text-gray-600',
}

const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'
const fecha = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const CONTACTO_KEY = 'soporte_contacto'

function Portal() {
  const sp = useSearchParams()
  const c = sp.get('c')
  const t = sp.get('t')

  const [cliente, setCliente] = useState('')
  const [tickets, setTickets] = useState<TicketPortal[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [recarga, setRecarga] = useState(0)
  const [formAbierto, setFormAbierto] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)

  useEffect(() => {
    if (!c || !t) return
    let cancelado = false
    fetch(`/api/soporte?c=${encodeURIComponent(c)}&t=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const j = await r.json()
        if (cancelado) return
        if (!r.ok) return setError(j.error ?? 'No se pudo cargar el portal.')
        setCliente(j.data.cliente)
        setTickets(j.data.tickets)
      })
      .catch(() => { if (!cancelado) setError('Revisa tu conexión a internet e intenta de nuevo.') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [c, t, recarga])

  const recargar = () => setRecarga((n) => n + 1)

  if (!c || !t || error) {
    return (
      <Marco>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <p className="font-medium text-gray-900">{error || 'Enlace de soporte no válido.'}</p>
          <p className="mt-1 text-sm text-gray-500">Pide tu enlace a Didara TI: direccion@didara-ti.com</p>
        </div>
      </Marco>
    )
  }

  const activos = tickets.filter((x) => !ESTADOS_CERRADOS.includes(x.estado))

  return (
    <Marco>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Portal de soporte</p>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{cargando ? 'Cargando…' : cliente}</h1>
        </div>
        {!cargando && (
          <button onClick={() => setFormAbierto(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
            <Plus size={17} /> Nuevo ticket
          </button>
        )}
      </div>

      {formAbierto && (
        <NuevoTicket c={c} t={t} onCerrar={() => setFormAbierto(false)}
          onCreado={(folio) => { setFormAbierto(false); setAbierto(folio); recargar() }} />
      )}

      {cargando ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-24 rounded-2xl bg-white animate-brillo" />)}</div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
          <MessageSquarePlus size={28} className="mx-auto text-brand-600" />
          <p className="mt-3 font-medium text-gray-900">¿Tienes un problema técnico?</p>
          <p className="mt-1 text-sm text-gray-500">Levanta un ticket y te atenderemos a la brevedad. Aquí verás su seguimiento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{activos.length} en atención · {tickets.length - activos.length} resueltos</p>
          {tickets.map((tk) => (
            <TarjetaTicket key={tk.folio} tk={tk} expandido={abierto === tk.folio}
              onAlternar={() => setAbierto(abierto === tk.folio ? null : tk.folio)} c={c} t={t} onRespondido={recargar} />
          ))}
        </div>
      )}
    </Marco>
  )
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Image src="/marca/simbolo.png" alt="" width={22} height={32} className="h-8 w-auto" priority />
          <div className="leading-none">
            <p className="font-semibold text-gray-900">Didara TI</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-brand-700">Soporte</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">{children}</main>
    </div>
  )
}

function TarjetaTicket({ tk, expandido, onAlternar, c, t, onRespondido }: {
  tk: TicketPortal; expandido: boolean; onAlternar: () => void; c: string; t: string; onRespondido: () => void
}) {
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function responder(e: React.FormEvent) {
    e.preventDefault()
    if (!mensaje.trim()) return
    setEnviando(true)
    try {
      const r = await fetch('/api/soporte/comentario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c, t, folio: tk.folio, mensaje }),
      })
      const j = await r.json()
      if (!r.ok) return aviso.error(j.error ?? 'No se pudo enviar tu mensaje')
      setMensaje('')
      aviso.exito('Mensaje enviado')
      onRespondido()
    } catch {
      aviso.error('Revisa tu conexión e intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02]">
      <button onClick={onAlternar} className="flex w-full items-start gap-3 p-4 text-left" aria-expanded={expandido}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-brand-700">{tk.folio}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${COLOR_ESTADO[tk.estado]}`}>{ETIQUETA_ESTADO[tk.estado]}</span>
            {tk.prioridad === 'urgente' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Urgente</span>}
          </div>
          <h3 className="mt-1 font-semibold text-gray-900">{tk.asunto}</h3>
          <p className="text-xs text-gray-500">{fecha(tk.created_at)} · {ETIQUETA_CATEGORIA[tk.categoria as keyof typeof ETIQUETA_CATEGORIA] ?? tk.categoria}</p>
        </div>
        <ChevronDown size={18} className={`mt-1 shrink-0 text-gray-400 transition-transform ${expandido ? 'rotate-180' : ''}`} />
      </button>

      {expandido && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-4">
          <p className="whitespace-pre-wrap text-sm text-gray-700">{tk.descripcion}</p>
          <ol className="mt-4 space-y-3 border-l-2 border-gray-200 pl-4">
            {tk.comentarios.map((cm, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${cm.es_sistema ? 'bg-gray-300' : 'bg-brand-500'}`} />
                <p className="text-xs text-gray-500"><span className="font-medium text-gray-700">{cm.autor_nombre}</span> · {fecha(cm.created_at)}</p>
                <p className={`mt-0.5 whitespace-pre-wrap text-sm ${cm.es_sistema ? 'italic text-gray-500' : 'text-gray-800'}`}>{cm.mensaje}</p>
              </li>
            ))}
          </ol>
          <form onSubmit={responder} className="mt-4 flex gap-2">
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2} maxLength={3000}
              placeholder={ESTADOS_CERRADOS.includes(tk.estado) ? '¿Sigue el problema? Escríbenos y reabrimos el ticket…' : 'Agregar información o responder…'}
              className={`${inputCls} resize-none`} />
            <button type="submit" disabled={enviando || !mensaje.trim()} aria-label="Enviar mensaje"
              className="self-end rounded-xl bg-brand-600 p-3 text-white hover:bg-brand-700 disabled:opacity-50">
              {enviando ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </form>
        </div>
      )}
    </article>
  )
}

function NuevoTicket({ c, t, onCerrar, onCreado }: { c: string; t: string; onCerrar: () => void; onCreado: (folio: string) => void }) {
  // El contacto se recuerda en este dispositivo para no capturarlo cada vez
  const [form, setForm] = useState(() => {
    let guardado = { contacto_nombre: '', contacto_email: '', contacto_telefono: '' }
    try { guardado = { ...guardado, ...JSON.parse(localStorage.getItem(CONTACTO_KEY) ?? '{}') } } catch { /* sin almacenamiento */ }
    return { ...guardado, categoria: 'soporte', prioridad: 'media', asunto: '', descripcion: '' }
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState<string | null>(null)
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const r = await fetch('/api/soporte', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c, t, ...form }),
      })
      const j = await r.json()
      if (!r.ok) return setError(j.error ?? 'No se pudo registrar tu ticket')
      try {
        localStorage.setItem(CONTACTO_KEY, JSON.stringify({ contacto_nombre: form.contacto_nombre, contacto_email: form.contacto_email, contacto_telefono: form.contacto_telefono }))
      } catch { /* sin almacenamiento */ }
      setHecho(j.data.folio)
    } catch {
      setError('Revisa tu conexión e intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (hecho) {
    return (
      <div className="rounded-2xl border border-green-200 bg-white p-6 text-center">
        <CheckCircle2 size={34} className="mx-auto text-green-600" />
        <p className="mt-3 text-lg font-semibold text-gray-900">Ticket {hecho} registrado</p>
        <p className="mt-1 text-sm text-gray-500">
          Ya avisamos al equipo de Didara TI.{form.contacto_email ? ' Te enviamos una confirmación por correo.' : ''}
        </p>
        <button onClick={() => onCreado(hecho)} className="mt-4 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Ver mi ticket
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Nuevo ticket de soporte</h2>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700"><X size={18} /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="mb-1 block text-sm font-medium text-gray-700">Tu nombre *</span>
          <input required value={form.contacto_nombre} onChange={(e) => set('contacto_nombre', e.target.value)} className={inputCls} autoComplete="name" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Correo</span>
          <input type="email" value={form.contacto_email} onChange={(e) => set('contacto_email', e.target.value)} className={inputCls} autoComplete="email" placeholder="Para avisarte" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Teléfono</span>
          <input type="tel" value={form.contacto_telefono} onChange={(e) => set('contacto_telefono', e.target.value)} className={inputCls} autoComplete="tel" />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">¿Sobre qué es?</span>
          <select value={form.categoria} onChange={(e) => set('categoria', e.target.value)} className={inputCls}>
            {CATEGORIAS_TICKET.map((k) => <option key={k} value={k}>{ETIQUETA_CATEGORIA[k]}</option>)}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">Prioridad</span>
          <div className="grid grid-cols-2 gap-2">
            {[['media', 'Normal'], ['urgente', 'Urgente']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => set('prioridad', v)} aria-pressed={form.prioridad === v}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  form.prioridad === v
                    ? v === 'urgente' ? 'border-red-400 bg-red-50 text-red-700' : 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Asunto *</span>
        <input required maxLength={150} value={form.asunto} onChange={(e) => set('asunto', e.target.value)} className={inputCls}
          placeholder="Ej. No imprime la impresora de recepción" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Describe el problema *</span>
        <textarea required rows={5} maxLength={5000} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)}
          className={`${inputCls} resize-y`} placeholder="¿Qué pasa, desde cuándo, en qué equipo o área?" />
      </label>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
        <button type="submit" disabled={enviando}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {enviando && <Loader2 size={16} className="animate-spin" />} Enviar ticket
        </button>
      </div>
    </form>
  )
}

export default function PaginaSoporte() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--bg)]" />}>
      <Portal />
    </Suspense>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Trash, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { borrar } from '@/lib/api-cliente'
import { BotonIcono, BotonPrincipal, EncabezadoPagina } from '@/components/ui/Pagina'
import type { Evento, Cliente, Usuario } from '@/types'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { esEncargado } from '@/lib/agenda'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const TIPOS_EVENTO = [
  { valor: 'instalacion',   label: 'Instalación',  emoji: '🔧' },
  { valor: 'entrega',       label: 'Entrega',       emoji: '📦' },
  { valor: 'mantenimiento', label: 'Mantenimiento', emoji: '⚙️' },
  { valor: 'compra',        label: 'Compra',        emoji: '🛒' },
  { valor: 'pago',          label: 'Pago',          emoji: '💳' },
  { valor: 'reunion',       label: 'Reunión',       emoji: '🤝' },
  { valor: 'capacitacion',  label: 'Capacitación',  emoji: '📚' },
  { valor: 'poliza',        label: 'Póliza',        emoji: '🛡️' },
]

const ESTADOS = ['Pendiente', 'En Proceso', 'Completado', 'Cancelado']

const estadoColors: Record<string, string> = {
  'Pendiente':   'bg-yellow-100 text-yellow-700',
  'En Proceso':  'bg-blue-100 text-blue-700',
  'Completado':  'bg-green-100 text-green-700',
  'Cancelado':   'bg-red-100 text-red-700',
}

function getEmoji(tipo: string) {
  return TIPOS_EVENTO.find(t => t.valor === tipo)?.emoji ?? '•'
}

function mismaFecha(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function primerDiaMes(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
}

function ultimoDiaMes(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)
}

// Lunes=0 ... Domingo=6
function diaSemana(fecha: Date) {
  return (fecha.getDay() + 6) % 7
}

function formatHora(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const FORM_VACIO = {
  titulo: '',
  tipo: 'instalacion',
  fecha: '',
  hora_inicio: '09:00',
  hora_fin: '10:00',
  todo_el_dia: false,
  cliente_id: '',
  lugar: '',
  contacto: '',
  estado: 'Pendiente',
  descripcion: '',
  notas_adicionales: '',
  color: '#3B82F6',
}

export default function AgendaPage() {
  const hoy = new Date()
  const hoyNorm = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())

  const [mes, setMes] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoy)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  // Modal evento
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Evento | null>(null)
  const [form, setForm] = useState({ ...FORM_VACIO })
  const [responsablesSeleccionados, setResponsablesSeleccionados] = useState<string[]>([])

  // Modal notificaciones
  const [modalNotifManual, setModalNotifManual] = useState(false)
  const [notifDescartada, setNotifDescartada] = useState(false)

  // Eventos del mes visible: se piden al cambiar de mes (el "cargando" se activa en cambiarMes)
  useEffect(() => {
    let cancelado = false
    const desde = primerDiaMes(mes).toISOString()
    const hasta = ultimoDiaMes(mes).toISOString()
    fetch(`/api/agenda?desde=${desde}&hasta=${hasta}`)
      .then(r => r.json())
      .then(json => { if (!cancelado) setEventos(json.data ?? []) })
      .catch(() => { if (!cancelado) aviso.error('No se pudieron cargar los eventos') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [mes])

  function cambiarMes(delta: number) {
    setLoading(true)
    setMes(new Date(mes.getFullYear(), mes.getMonth() + delta, 1))
  }

  function irAHoy() {
    if (mes.getMonth() !== hoy.getMonth() || mes.getFullYear() !== hoy.getFullYear()) {
      setLoading(true)
      setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    }
    setDiaSeleccionado(hoy)
  }

  // Carga inicial: clientes, usuarios y usuario actual
  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then(j => setClientes(j.data ?? []))

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      fetch('/api/admin/usuarios')
        .then(r => r.json())
        .then(j => {
          const lista: Usuario[] = j.data ?? []
          setUsuarios(lista)
          const yo = lista.find(u => u.id === user.id)
          if (yo) setUsuarioActual(yo)
        })
    })
  }, [])

  // Eventos del usuario en los próximos 3 días (se muestran una vez al entrar)
  const eventosProximos = useMemo(() => {
    if (!usuarioActual) return []
    const ahora = new Date()
    const en3Dias = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000)
    return eventos.filter(ev => {
      const f = new Date(ev.fecha_inicio)
      return f >= ahora && f <= en3Dias && esEncargado(ev.responsables, usuarioActual.nombre)
    })
  }, [usuarioActual, eventos])

  const modalNotif = modalNotifManual || (eventosProximos.length > 0 && !notifDescartada)
  function cerrarNotif() {
    setModalNotifManual(false)
    setNotifDescartada(true)
  }

  // Construir grid del mes
  const primerDia = primerDiaMes(mes)
  const ultimoDia = ultimoDiaMes(mes)
  const offsetInicio = diaSemana(primerDia)
  const totalDias = ultimoDia.getDate()
  const totalCeldas = Math.ceil((offsetInicio + totalDias) / 7) * 7
  const celdas: (Date | null)[] = Array.from({ length: totalCeldas }, (_, i) => {
    const d = i - offsetInicio + 1
    if (d < 1 || d > totalDias) return null
    return new Date(mes.getFullYear(), mes.getMonth(), d)
  })

  // Eventos del día seleccionado
  const eventosDia = eventos
    .filter(ev => mismaFecha(new Date(ev.fecha_inicio), diaSeleccionado))
    .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())

  function abrirNuevo() {
    setEditando(null)
    const fechaStr = diaSeleccionado.toISOString().slice(0, 10)
    setForm({ ...FORM_VACIO, fecha: fechaStr })
    setResponsablesSeleccionados([])
    setModal(true)
  }

  function abrirEditar(ev: Evento) {
    setEditando(ev)
    const f = new Date(ev.fecha_inicio)
    setForm({
      titulo: ev.titulo,
      tipo: ev.tipo,
      fecha: f.toISOString().slice(0, 10),
      hora_inicio: f.toTimeString().slice(0, 5),
      hora_fin: ev.fecha_fin ? new Date(ev.fecha_fin).toTimeString().slice(0, 5) : '10:00',
      todo_el_dia: ev.todo_el_dia,
      cliente_id: ev.cliente_id?.toString() ?? '',
      lugar: ev.lugar ?? '',
      contacto: ev.contacto ?? '',
      estado: ev.estado ?? 'Pendiente',
      descripcion: ev.descripcion ?? '',
      notas_adicionales: ev.notas_adicionales ?? '',
      color: ev.color ?? '#3B82F6',
    })
    setResponsablesSeleccionados(
      ev.responsables ? ev.responsables.split(',').map(n => n.trim()).filter(Boolean) : []
    )
    setModal(true)
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fechaInicio = form.todo_el_dia
      ? form.fecha
      : `${form.fecha}T${form.hora_inicio}`
    const fechaFin = form.todo_el_dia
      ? undefined
      : `${form.fecha}T${form.hora_fin}`

    const payload = {
      titulo: form.titulo,
      tipo: form.tipo,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin ?? null,
      todo_el_dia: form.todo_el_dia,
      cliente_id: form.cliente_id ? parseInt(form.cliente_id) : null,
      lugar: form.lugar || null,
      contacto: form.contacto || null,
      responsables: responsablesSeleccionados.join(', ') || null,
      estado: form.estado,
      descripcion: form.descripcion || null,
      notas_adicionales: form.notas_adicionales || null,
      color: form.color,
    }

    const res = await fetch(editando ? `/api/agenda/${editando.id}` : '/api/agenda', {
      method: editando ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) return aviso.error(json.error ?? 'No se pudo guardar el evento')
    aviso.exito(editando ? 'Evento actualizado' : 'Evento creado')
    if (editando) {
      setEventos(prev => prev.map(ev => ev.id === editando.id ? json.data : ev))
    } else {
      setEventos(prev => [...prev, json.data])
    }
    setModal(false)
  }

  async function eliminar(id: number) {
    if (!(await confirmar({ titulo: '¿Eliminar este evento?', mensaje: 'Esta acción no se puede deshacer.', peligro: true }))) return
    if (!(await borrar(`/api/agenda/${id}`, 'No se pudo eliminar el evento'))) return
    setEventos(prev => prev.filter(ev => ev.id !== id))
  }

  async function limpiarMesAnterior() {
    if (!(await confirmar({ titulo: '¿Eliminar todos los eventos del mes anterior?', mensaje: 'Esta acción no se puede deshacer.', peligro: true }))) return
    const mesPasado = new Date(mes.getFullYear(), mes.getMonth() - 1, 1)
    const desde = primerDiaMes(mesPasado).toISOString()
    const hasta = ultimoDiaMes(mesPasado).toISOString()
    const res = await fetch(`/api/agenda?desde=${desde}&hasta=${hasta}`)
    const json = await res.json()
    const eventosPasados: Evento[] = json.data ?? []
    await Promise.all(eventosPasados.map(ev => fetch(`/api/agenda/${ev.id}`, { method: 'DELETE' })))
    aviso.exito(`${eventosPasados.length} evento(s) eliminados`)
  }

  function toggleResponsable(nombre: string, checked: boolean) {
    setResponsablesSeleccionados(prev =>
      checked ? [...prev, nombre] : prev.filter(n => n !== nombre)
    )
  }

  const etiquetaDia = diaSeleccionado.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Agenda"
        subtitulo={`${eventos.length} evento${eventos.length === 1 ? '' : 's'} en ${MESES[mes.getMonth()].toLowerCase()}`}
        acciones={<>
          {eventosProximos.length > 0 && (
            <button
              onClick={() => setModalNotifManual(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
            >
              <Bell size={15} />
              {eventosProximos.length}<span className="hidden sm:inline"> próximo{eventosProximos.length > 1 ? 's' : ''}</span>
            </button>
          )}
          <BotonIcono titulo="Eliminar los eventos del mes anterior" tono="peligro" onClick={limpiarMesAnterior}
            className="border border-gray-200 bg-white !p-2.5">
            <Trash size={16} />
          </BotonIcono>
          <BotonPrincipal onClick={abrirNuevo}>
            <Plus size={17} /> <span className="hidden sm:inline">Nuevo evento</span><span className="sm:hidden">Nuevo</span>
          </BotonPrincipal>
        </>}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Calendario */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02]">
          {/* Navegación del mes */}
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-3 sm:px-4">
            <div className="flex items-center gap-1">
              <BotonIcono titulo="Mes anterior" onClick={() => cambiarMes(-1)}><ChevronLeft size={18} /></BotonIcono>
              <BotonIcono titulo="Mes siguiente" onClick={() => cambiarMes(1)}><ChevronRight size={18} /></BotonIcono>
            </div>
            <h2 className="font-semibold text-gray-900">
              {MESES[mes.getMonth()]} {mes.getFullYear()}
            </h2>
            <button onClick={irAHoy}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Hoy
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">{d}</div>
            ))}
          </div>

          {/* Grid de días */}
          <div className={`grid grid-cols-7 transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
            {celdas.map((dia, i) => {
              if (!dia) {
                return <div key={`empty-${i}`} className="h-14 border-b border-r border-gray-100 bg-gray-50/60 sm:h-24" />
              }
              const esHoy = mismaFecha(dia, hoy)
              const esSeleccionado = mismaFecha(dia, diaSeleccionado)
              const esPasado = dia < hoyNorm
              const eventosDelDia = eventos.filter(ev => mismaFecha(new Date(ev.fecha_inicio), dia))
              return (
                <button
                  key={dia.toISOString()}
                  onClick={() => setDiaSeleccionado(dia)}
                  onDoubleClick={() => { setDiaSeleccionado(dia); abrirNuevo() }}
                  aria-label={`${dia.getDate()} de ${MESES[dia.getMonth()]}, ${eventosDelDia.length} evento(s)`}
                  aria-pressed={esSeleccionado}
                  className={`flex h-14 flex-col items-center gap-1 border-b border-r border-gray-100 p-1 transition-colors sm:h-24 sm:items-stretch sm:p-1.5 ${
                    esSeleccionado ? 'bg-brand-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium sm:self-end ${
                      esHoy ? 'bg-brand-600 text-white'
                      : esSeleccionado ? 'text-brand-700 ring-2 ring-brand-300'
                      : esPasado ? 'text-gray-400' : 'text-gray-700'
                    }`}
                  >
                    {dia.getDate()}
                  </span>
                  {/* Celular: puntos de color */}
                  <div className="flex gap-0.5 sm:hidden">
                    {eventosDelDia.slice(0, 3).map(ev => (
                      <span key={ev.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ev.color ?? '#187d78' }} />
                    ))}
                  </div>
                  {/* Escritorio: títulos */}
                  <div className="hidden min-w-0 space-y-0.5 sm:block">
                    {eventosDelDia.slice(0, 2).map(ev => (
                      <span key={ev.id}
                        className={`block truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white ${esPasado && !esHoy ? 'opacity-60' : ''}`}
                        style={{ backgroundColor: ev.color ?? '#187d78' }}>
                        {getEmoji(ev.tipo)} {ev.titulo}
                      </span>
                    ))}
                    {eventosDelDia.length > 2 && (
                      <span className="block px-1 text-left text-[11px] text-gray-500">+{eventosDelDia.length - 2} más</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Eventos del día seleccionado */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02] lg:sticky lg:top-4">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="font-semibold text-gray-900 first-letter:uppercase">{etiquetaDia}</h3>
            <span className="text-xs text-gray-400">{eventosDia.length} evento{eventosDia.length !== 1 ? 's' : ''}</span>
          </div>
          {eventosDia.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">
              No hay eventos este día.
              <button onClick={abrirNuevo} className="mt-2 block w-full font-medium text-brand-700 hover:underline">+ Agregar uno</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {eventosDia.map(ev => {
                const cliente = ev.cliente as { nombre: string } | undefined
                const tipoInfo = TIPOS_EVENTO.find(t => t.valor === ev.tipo)
                return (
                  <div key={ev.id} className="relative flex items-start gap-3 py-3 pl-5 pr-2">
                    <span className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ backgroundColor: ev.color ?? '#187d78' }} />
                    <span className="mt-0.5 text-xl leading-none">{tipoInfo?.emoji ?? '•'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug text-gray-900">{ev.titulo}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                        <span>{ev.todo_el_dia ? 'Todo el día' : `${formatHora(ev.fecha_inicio)}${ev.fecha_fin ? ` – ${formatHora(ev.fecha_fin)}` : ''}`}</span>
                        {ev.estado && (
                          <span className={`rounded-full px-2 py-0.5 font-medium ${estadoColors[ev.estado] ?? 'bg-gray-100 text-gray-600'}`}>{ev.estado}</span>
                        )}
                      </div>
                      {(cliente || ev.lugar || ev.responsables) && (
                        <p className="mt-1 text-xs text-gray-500">
                          {[cliente?.nombre, ev.lugar, ev.responsables ? `👤 ${ev.responsables}` : ''].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {ev.descripcion && <p className="mt-1 line-clamp-2 text-xs text-gray-400">{ev.descripcion}</p>}
                    </div>
                    <div className="flex shrink-0">
                      <BotonIcono titulo="Editar" tono="marca" onClick={() => abrirEditar(ev)}><Pencil size={15} /></BotonIcono>
                      <BotonIcono titulo="Eliminar" tono="peligro" onClick={() => eliminar(ev.id)}><Trash2 size={15} /></BotonIcono>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal nuevo/editar evento */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-aparecer sm:items-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full animate-subir max-w-lg flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-lg font-semibold">
                {editando ? 'Editar evento' : 'Nuevo evento'}
              </h2>
              <button type="button" onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={guardar} className="px-6 py-4 space-y-4 overflow-y-auto">

              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Tipo + Estado */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {TIPOS_EVENTO.map(t => (
                      <option key={t.valor} value={t.valor}>{t.emoji} {t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {ESTADOS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fecha + horas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {!form.todo_el_dia && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
                    <input
                      type="time"
                      value={form.hora_inicio}
                      onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
                    <input
                      type="time"
                      value={form.hora_fin}
                      onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.todo_el_dia}
                  onChange={e => setForm(f => ({ ...f, todo_el_dia: e.target.checked }))}
                  className="rounded border-gray-300 text-brand-600"
                />
                <span className="text-sm text-gray-700">Todo el día</span>
              </label>

              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select
                  value={form.cliente_id}
                  onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Sin cliente</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Lugar + Contacto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección / Lugar</label>
                  <input
                    type="text"
                    value={form.lugar}
                    onChange={e => setForm(f => ({ ...f, lugar: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
                  <input
                    type="text"
                    value={form.contacto}
                    onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Responsables */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsables</label>
                <div className="border border-gray-300 rounded-lg p-2 max-h-32 overflow-y-auto grid grid-cols-2 gap-1">
                  {usuarios.length === 0 && (
                    <p className="text-xs text-gray-400 col-span-2">Cargando usuarios...</p>
                  )}
                  {usuarios.map(u => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={responsablesSeleccionados.includes(u.nombre)}
                        onChange={e => toggleResponsable(u.nombre, e.target.checked)}
                        className="rounded border-gray-300 text-brand-600"
                      />
                      {u.nombre}
                    </label>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              {/* Notas adicionales */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
                <textarea
                  value={form.notas_adicionales}
                  onChange={e => setForm(f => ({ ...f, notas_adicionales: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal notificaciones próximos 3 días */}
      {modalNotif && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-aparecer sm:items-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full animate-subir max-h-[92dvh] overflow-y-auto max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-brand-600" />
                <h2 className="text-lg font-semibold">Tus próximos eventos</h2>
              </div>
              <button onClick={cerrarNotif} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-500">Tienes {eventosProximos.length} evento{eventosProximos.length > 1 ? 's' : ''} en los próximos 3 días:</p>
              <div className="divide-y divide-gray-100">
                {eventosProximos.map(ev => {
                  const f = new Date(ev.fecha_inicio)
                  const tipoInfo = TIPOS_EVENTO.find(t => t.valor === ev.tipo)
                  return (
                    <div key={ev.id} className="py-3 flex items-start gap-3">
                      <span className="text-xl leading-none">{tipoInfo?.emoji ?? '•'}</span>
                      <div>
                        <p className="font-medium text-gray-900">{ev.titulo}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {f.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {!ev.todo_el_dia && ` · ${formatHora(ev.fecha_inicio)}`}
                          {ev.lugar ? ` · ${ev.lugar}` : ''}
                        </p>
                        {ev.estado && (
                          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[ev.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                            {ev.estado}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="px-6 pb-4">
              <button
                onClick={cerrarNotif}
                className="w-full px-4 py-2 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

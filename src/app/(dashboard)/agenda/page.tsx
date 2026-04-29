'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Trash, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Evento, Cliente, Usuario } from '@/types'

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
  const [modalNotif, setModalNotif] = useState(false)
  const [eventosProximos, setEventosProximos] = useState<Evento[]>([])
  const [notifMostrada, setNotifMostrada] = useState(false)

  const cargarEventos = useCallback(async (fechaMes: Date) => {
    setLoading(true)
    const desde = primerDiaMes(fechaMes).toISOString()
    const hasta = ultimoDiaMes(fechaMes).toISOString()
    const res = await fetch(`/api/agenda?desde=${desde}&hasta=${hasta}`)
    const json = await res.json()
    setEventos(json.data ?? [])
    setLoading(false)
  }, [])

  // Carga inicial: eventos, clientes, usuarios, usuario actual
  useEffect(() => {
    cargarEventos(mes)

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mes) cargarEventos(mes)
  }, [mes, cargarEventos])

  // Mostrar modal de notificaciones (solo una vez por sesión)
  useEffect(() => {
    if (!usuarioActual || eventos.length === 0 || notifMostrada) return
    const ahora = new Date()
    const en3Dias = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000)
    const proximos = eventos.filter(ev => {
      const f = new Date(ev.fecha_inicio)
      return f >= ahora && f <= en3Dias &&
        ev.responsables?.split(',').map(n => n.trim()).includes(usuarioActual.nombre)
    })
    if (proximos.length > 0) {
      setEventosProximos(proximos)
      setModalNotif(true)
      setNotifMostrada(true)
    }
  }, [usuarioActual, eventos, notifMostrada])

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
    if (!res.ok) return alert(json.error)
    if (editando) {
      setEventos(prev => prev.map(ev => ev.id === editando.id ? json.data : ev))
    } else {
      setEventos(prev => [...prev, json.data])
    }
    setModal(false)
  }

  async function eliminar(id: number) {
    if (!confirm('¿Eliminar este evento?')) return
    await fetch(`/api/agenda/${id}`, { method: 'DELETE' })
    setEventos(prev => prev.filter(ev => ev.id !== id))
  }

  async function limpiarMesAnterior() {
    if (!confirm('¿Eliminar todos los eventos del mes anterior?')) return
    const mesPasado = new Date(mes.getFullYear(), mes.getMonth() - 1, 1)
    const desde = primerDiaMes(mesPasado).toISOString()
    const hasta = ultimoDiaMes(mesPasado).toISOString()
    const res = await fetch(`/api/agenda?desde=${desde}&hasta=${hasta}`)
    const json = await res.json()
    const eventosPasados: Evento[] = json.data ?? []
    await Promise.all(eventosPasados.map(ev => fetch(`/api/agenda/${ev.id}`, { method: 'DELETE' })))
    alert(`${eventosPasados.length} evento(s) eliminados.`)
  }

  function toggleResponsable(nombre: string, checked: boolean) {
    setResponsablesSeleccionados(prev =>
      checked ? [...prev, nombre] : prev.filter(n => n !== nombre)
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <div className="flex items-center gap-2">
          {eventosProximos.length > 0 && (
            <button
              onClick={() => setModalNotif(true)}
              className="relative flex items-center gap-1.5 text-xs text-blue-600 border border-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Bell size={13} />
              {eventosProximos.length} próximo{eventosProximos.length > 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={limpiarMesAnterior}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 border border-gray-300 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
            title="Eliminar eventos del mes anterior"
          >
            <Trash size={13} />
            Limpiar mes anterior
          </button>
          <button
            onClick={abrirNuevo}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nuevo evento
          </button>
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Navegación del mes */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <button
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-semibold text-gray-900">
            {MESES[mes.getMonth()]} {mes.getFullYear()}
          </h2>
          <button
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>
          ))}
        </div>

        {/* Grid de días */}
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Cargando...</div>
        ) : (
          <div className="grid grid-cols-7">
            {celdas.map((dia, i) => {
              if (!dia) {
                return <div key={`empty-${i}`} className="h-16 border-b border-r border-gray-100 bg-gray-50/50" />
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
                  className={`h-16 border-b border-r border-gray-100 flex flex-col items-center pt-2 gap-0.5 transition-colors ${
                    esSeleccionado ? 'bg-blue-50' : 'hover:bg-gray-50'
                  } ${esPasado && !esHoy ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                      esHoy
                        ? 'bg-blue-600 text-white'
                        : esSeleccionado
                        ? 'text-blue-600'
                        : 'text-gray-700'
                    }`}
                  >
                    {dia.getDate()}
                  </span>
                  {/* Emojis de eventos */}
                  <div className="flex flex-wrap justify-center gap-0.5 leading-none">
                    {eventosDelDia.slice(0, 2).map(ev => (
                      <span key={ev.id} className="text-xs leading-none">{getEmoji(ev.tipo)}</span>
                    ))}
                    {eventosDelDia.length > 2 && (
                      <span className="text-xs text-gray-400 leading-none">+{eventosDelDia.length - 2}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Lista de eventos del día seleccionado */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-medium text-gray-900 capitalize">
            {diaSeleccionado.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <span className="text-xs text-gray-400">{eventosDia.length} evento{eventosDia.length !== 1 ? 's' : ''}</span>
        </div>
        {eventosDia.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            No hay eventos este día.{' '}
            <button onClick={abrirNuevo} className="text-blue-600 hover:underline">Agregar uno</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {eventosDia.map(ev => {
              const cliente = ev.cliente as { nombre: string } | undefined
              const tipoInfo = TIPOS_EVENTO.find(t => t.valor === ev.tipo)
              return (
                <div key={ev.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <span className="text-xl leading-none mt-0.5">{tipoInfo?.emoji ?? '•'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!ev.todo_el_dia && (
                        <span className="text-sm font-medium text-gray-500 shrink-0">
                          {formatHora(ev.fecha_inicio)}
                          {ev.fecha_fin ? ` – ${formatHora(ev.fecha_fin)}` : ''}
                        </span>
                      )}
                      <p className="font-medium text-gray-900 truncate">{ev.titulo}</p>
                      {ev.estado && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${estadoColors[ev.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                          {ev.estado}
                        </span>
                      )}
                    </div>
                    {(cliente || ev.lugar || ev.responsables) && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {[cliente?.nombre, ev.lugar, ev.responsables ? `👤 ${ev.responsables}` : ''].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {ev.descripcion && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{ev.descripcion}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => abrirEditar(ev)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => eliminar(ev.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal nuevo/editar evento */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Tipo + Estado */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
                    <input
                      type="time"
                      value={form.hora_fin}
                      onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.todo_el_dia}
                  onChange={e => setForm(f => ({ ...f, todo_el_dia: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Todo el día</span>
              </label>

              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select
                  value={form.cliente_id}
                  onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
                  <input
                    type="text"
                    value={form.contacto}
                    onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="rounded border-gray-300 text-blue-600"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Notas adicionales */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
                <textarea
                  value={form.notas_adicionales}
                  onChange={e => setForm(f => ({ ...f, notas_adicionales: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-blue-600" />
                <h2 className="text-lg font-semibold">Tus próximos eventos</h2>
              </div>
              <button onClick={() => setModalNotif(false)} className="text-gray-400 hover:text-gray-600">✕</button>
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
                onClick={() => setModalNotif(false)}
                className="w-full px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
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

'use client'

import { useEffect, useState } from 'react'
import { X, Calendar } from 'lucide-react'

interface EventoProximo {
  id: number
  titulo: string
  tipo: string
  fecha_inicio: string
  estado?: string
}

const SESSION_KEY = 'agenda_alert_dismissed'

export default function AgendaAlert({ userId }: { userId: string }) {
  const [eventos, setEventos] = useState<EventoProximo[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!userId) return
    if (sessionStorage.getItem(SESSION_KEY)) return

    fetch(`/api/notificaciones/eventos-proximos?userId=${userId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.length > 0) {
          setEventos(j.data)
          setVisible(true)
        }
      })
      .catch(() => {})
  }, [userId])

  function cerrar() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setVisible(false)
  }

  if (!visible || eventos.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold text-gray-900">Eventos próximos (7 días)</h2>
          </div>
          <button onClick={cerrar} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-500">Tienes los siguientes eventos asignados en los próximos 7 días:</p>
          <div className="space-y-2">
            {eventos.map((ev) => {
              const fecha = new Date(
                ev.fecha_inicio.length === 10
                  ? ev.fecha_inicio + 'T00:00:00'
                  : ev.fecha_inicio
              )
              const hoy = new Date()
              hoy.setHours(0, 0, 0, 0)
              const diasRestantes = Math.round(
                (fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
              )
              return (
                <div
                  key={ev.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{ev.titulo}</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      {diasRestantes === 0
                        ? 'Hoy'
                        : diasRestantes === 1
                        ? 'Mañana'
                        : `En ${diasRestantes} días`}
                      {' · '}{ev.tipo}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-3">
                    {fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400">Este aviso no se repetirá en esta sesión.</p>
        </div>

        <div className="px-5 pb-4 flex justify-end">
          <button
            onClick={cerrar}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

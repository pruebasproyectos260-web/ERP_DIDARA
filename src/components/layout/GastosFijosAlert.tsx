'use client'

import { useEffect, useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

interface GastoProximo {
  id: number
  nombre: string
  monto: number
  dia: number
  diasRestantes: number
  fechaVencimiento: string
}

const SESSION_KEY = 'gastos_alert_dismissed'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

export default function GastosFijosAlert({ nivel }: { nivel: number }) {
  const [gastos, setGastos] = useState<GastoProximo[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (nivel > 1) return
    if (sessionStorage.getItem(SESSION_KEY)) return

    fetch('/api/notificaciones/gastos-proximos')
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.length > 0) {
          setGastos(j.data)
          setVisible(true)
        }
      })
      .catch(() => {})
  }, [nivel])

  function cerrar() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setVisible(false)
  }

  if (!visible || gastos.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Pagos próximos</h2>
          </div>
          <button onClick={cerrar} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-500">Los siguientes gastos fijos vencen en los próximos 5 días:</p>
          <div className="space-y-2">
            {gastos.map((g) => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{g.nombre}</p>
                  <p className="text-xs text-orange-700 mt-0.5">
                    {g.diasRestantes === 0
                      ? 'Vence hoy'
                      : g.diasRestantes === 1
                      ? 'Vence mañana'
                      : `Vence en ${g.diasRestantes} días`}
                    {' '}(día {g.dia})
                  </p>
                </div>
                <p className="text-sm font-bold text-red-700">{fmt(g.monto)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">Este aviso no se repetirá en esta sesión.</p>
        </div>

        <div className="px-5 pb-4 flex justify-end">
          <button onClick={cerrar}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors">
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

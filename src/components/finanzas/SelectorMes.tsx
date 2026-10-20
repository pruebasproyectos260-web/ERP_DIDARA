'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { mesActual, nombreMes, sumarMeses } from '@/lib/finanzas'

/** ◀ Octubre 2026 ▶  (no deja avanzar más allá del mes actual, salvo `permitirFuturo`) */
export default function SelectorMes({ mes, onCambio, permitirFuturo = false }: {
  mes: string
  onCambio: (mes: string) => void
  permitirFuturo?: boolean
}) {
  const hoy = mesActual()
  const puedeAvanzar = permitirFuturo || mes < hoy
  return (
    <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-1">
      <button type="button" onClick={() => onCambio(sumarMeses(mes, -1))} aria-label="Mes anterior"
        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
        <ChevronLeft size={18} />
      </button>
      <span className="min-w-[8.5rem] px-1 text-center text-sm font-semibold text-gray-900">{nombreMes(mes)}</span>
      <button type="button" onClick={() => onCambio(sumarMeses(mes, 1))} disabled={!puedeAvanzar} aria-label="Mes siguiente"
        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent">
        <ChevronRight size={18} />
      </button>
      {mes !== hoy && (
        <button type="button" onClick={() => onCambio(hoy)}
          className="ml-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
          Hoy
        </button>
      )}
    </div>
  )
}

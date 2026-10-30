'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, X } from 'lucide-react'
import { formatoMoneda } from '@/lib/finanzas'
import type { FijoPorPagar } from '@/lib/transportes-servidor'

const SESSION_KEY = 'tcg_fijos_alert_dismissed'

const cuando = (d: number) =>
  d < 0 ? `Venció hace ${-d} día${d === -1 ? '' : 's'}` : d === 0 ? 'Vence hoy' : d === 1 ? 'Vence mañana' : `Vence en ${d} días`

/** Al entrar a Transportes: gastos fijos sin pagar que vencieron o están por vencer (una vez por sesión) */
export default function FijosTCGAlert() {
  const [lista, setLista] = useState<FijoPorPagar[]>([])

  useEffect(() => {
    try { if (sessionStorage.getItem(SESSION_KEY)) return } catch { /* sin almacenamiento */ }
    fetch('/api/transportes/fijos/proximos')
      .then((r) => r.json())
      .then((j) => setLista(j.data ?? []))
      .catch(() => {})
  }, [])

  function cerrar() {
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* sin almacenamiento */ }
    setLista([])
  }

  if (lista.length === 0) return null
  const destino = lista.every((f) => f.ambito === 'hogar') ? '/transportes/hogar' : '/transportes/gastos'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-aparecer sm:items-center sm:p-4" onMouseDown={cerrar}>
      <div onMouseDown={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl animate-subir sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">Gastos fijos por pagar</h2>
          </div>
          <button onClick={cerrar} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-2 px-5 py-4">
          {lista.map((f) => (
            <div key={`${f.id}-${f.mes}`} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${f.diasRestantes < 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{f.nombre}</p>
                <p className={`mt-0.5 text-xs ${f.diasRestantes < 0 ? 'font-semibold text-red-700' : 'text-amber-800'}`}>
                  {cuando(f.diasRestantes)} · {f.ambito === 'hogar' ? 'Hogar' : 'Empresa'}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums text-gray-900">{formatoMoneda(f.monto)}</p>
            </div>
          ))}
          <p className="pt-1 text-xs text-gray-400">Este aviso no se repite en esta sesión.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button onClick={cerrar} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Entendido</button>
          <Link href={destino} onClick={cerrar} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Ver gastos fijos</Link>
        </div>
      </div>
    </div>
  )
}

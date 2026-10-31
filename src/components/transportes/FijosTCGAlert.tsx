'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Car, Droplet, FileText, Repeat, Truck, X } from 'lucide-react'
import { formatoMoneda } from '@/lib/finanzas'
import type { FijoPorPagar, PendienteVehiculo } from '@/lib/transportes-servidor'

const SESSION_KEY = 'tcg_fijos_alert_dismissed'

const cuando = (d: number) =>
  d < 0 ? `Venció hace ${-d} día${d === -1 ? '' : 's'}` : d === 0 ? 'Vence hoy' : d === 1 ? 'Vence mañana' : `Vence en ${d} días`

function detalleVehiculo(v: PendienteVehiculo) {
  if (v.tipo === 'documento') return v.diasRestantes != null ? cuando(v.diasRestantes) : ''
  const partes = []
  if (v.faltanKm != null) partes.push(v.faltanKm <= 0 ? `pasado por ${(-v.faltanKm).toLocaleString('es-MX')} km` : `faltan ${v.faltanKm.toLocaleString('es-MX')} km`)
  if (v.diasRestantes != null) partes.push(v.diasRestantes < 0 ? `pasado por ${-v.diasRestantes} días` : `en ${v.diasRestantes} días`)
  return partes.join(' · ')
}

/**
 * Al entrar a Transportes (una vez por sesión): gastos fijos vencidos o por vencer, y de los vehículos
 * los documentos vencidos o por vencer y los cambios de aceite próximos.
 */
export default function FijosTCGAlert() {
  const [datos, setDatos] = useState<{ fijos: FijoPorPagar[]; vehiculos: PendienteVehiculo[] } | null>(null)

  useEffect(() => {
    try { if (sessionStorage.getItem(SESSION_KEY)) return } catch { /* sin almacenamiento */ }
    fetch('/api/transportes/fijos/proximos')
      .then((r) => r.json())
      .then((j) => setDatos(j.data ?? null))
      .catch(() => {})
  }, [])

  function cerrar() {
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* sin almacenamiento */ }
    setDatos(null)
  }

  const fijos = datos?.fijos ?? [], vehiculos = datos?.vehiculos ?? []
  if (!fijos.length && !vehiculos.length) return null
  const destino = fijos.length
    ? (fijos.every((f) => f.ambito === 'hogar') ? '/transportes/hogar' : '/transportes/gastos')
    : (vehiculos.every((v) => v.uso === 'familia') ? '/transportes/carros' : '/transportes/camiones')
  const tono = (vencido: boolean) => (vencido ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50')
  const textoTono = (vencido: boolean) => (vencido ? 'font-semibold text-red-700' : 'text-amber-800')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-aparecer sm:items-center sm:p-4" onMouseDown={cerrar}>
      <div onMouseDown={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl animate-subir sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">Pendientes de Transportes</h2>
          </div>
          <button onClick={cerrar} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-2 px-5 py-4">
          {fijos.map((f) => (
            <div key={`f${f.id}-${f.mes}`} className={`flex items-center gap-3 rounded-xl border p-3 ${tono(f.diasRestantes < 0)}`}>
              <Repeat size={16} className="shrink-0 text-gray-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{f.nombre}</p>
                <p className={`mt-0.5 text-xs ${textoTono(f.diasRestantes < 0)}`}>{cuando(f.diasRestantes)} · {f.ambito === 'hogar' ? 'Hogar' : 'Empresa'}</p>
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums text-gray-900">{formatoMoneda(f.monto)}</p>
            </div>
          ))}
          {vehiculos.map((v) => {
            const vencido = v.estado === 'vencido'
            const Icono = v.tipo === 'aceite' ? Droplet : FileText
            return (
              <div key={`v${v.camion_id}-${v.documento_id ?? 'aceite'}`} className={`flex items-center gap-3 rounded-xl border p-3 ${tono(vencido)}`}>
                <Icono size={16} className="shrink-0 text-gray-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{v.titulo}</p>
                  <p className={`mt-0.5 flex items-center gap-1 text-xs ${textoTono(vencido)}`}>
                    {v.uso === 'familia' ? <Car size={12} /> : <Truck size={12} />} {v.vehiculo} · {detalleVehiculo(v)}
                  </p>
                </div>
              </div>
            )
          })}
          <p className="pt-1 text-xs text-gray-400">Este aviso no se repite en esta sesión.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button onClick={cerrar} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Entendido</button>
          <Link href={destino} onClick={cerrar} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Ver</Link>
        </div>
      </div>
    </div>
  )
}

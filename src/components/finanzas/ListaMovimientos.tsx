'use client'

import { Check, FileCheck, Paperclip, Repeat } from 'lucide-react'
import { formatoMoneda, hoyISO, type Movimiento } from '@/lib/finanzas'
import { BurbujaCategoria } from './categorias'

function etiquetaDia(fecha: string) {
  const hoy = hoyISO()
  const ayer = new Date(Date.now() - 86_400_000)
  const ayerISO = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`
  if (fecha === hoy) return 'Hoy'
  if (fecha === ayerISO) return 'Ayer'
  const t = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Movimientos agrupados por día, con el total de cada día */
export default function ListaMovimientos({ movimientos, completo, onAbrir, onRevisar }: {
  movimientos: Movimiento[]
  /** Administración/contabilidad: muestra quién lo registró y el botón de revisar */
  completo: boolean
  onAbrir: (m: Movimiento) => void
  onRevisar?: (m: Movimiento) => void
}) {
  const dias = new Map<string, Movimiento[]>()
  for (const m of movimientos) {
    if (!dias.has(m.fecha)) dias.set(m.fecha, [])
    dias.get(m.fecha)!.push(m)
  }

  return (
    <div className="space-y-4">
      {[...dias.entries()].map(([fecha, lista]) => {
        const neto = lista.reduce((a, m) => a + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0)
        return (
          <section key={fecha}>
            <div className="mb-1.5 flex items-baseline justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{etiquetaDia(fecha)}</h3>
              <span className={`text-xs font-medium ${neto >= 0 ? 'text-green-600' : 'text-gray-500'}`}>
                {neto >= 0 ? '+' : '−'}{formatoMoneda(Math.abs(neto))}
              </span>
            </div>
            <ul className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02]">
              {lista.map((m) => {
                const titulo = m.descripcion || m.categoria
                const detalle = [
                  m.descripcion ? m.categoria : null,
                  m.proveedor,
                  m.cliente?.nombre,
                  m.metodo_pago,
                  completo ? m.registrado_nombre : null,
                ].filter(Boolean).join(' · ')
                return (
                  <li key={m.id} className="border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-gray-50">
                      <button onClick={() => onAbrir(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <BurbujaCategoria categoria={m.categoria} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-gray-900">{titulo}</span>
                            {m.recurrente_id && <Repeat size={12} className="shrink-0 text-gray-400" aria-label="Pago fijo" />}
                            {m.con_factura && <FileCheck size={13} className="shrink-0 text-brand-600" aria-label="Con factura" />}
                            {m.comprobantes.length > 0 && <Paperclip size={12} className="shrink-0 text-gray-400" aria-label="Con comprobante" />}
                          </span>
                          {detalle && <span className="block truncate text-xs text-gray-500">{detalle}</span>}
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={`block text-sm font-semibold tabular-nums ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-gray-900'}`}>
                            {m.tipo === 'ingreso' ? '+' : '−'}{formatoMoneda(m.monto)}
                          </span>
                          {!m.revisado && (
                            <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-800">Por revisar</span>
                          )}
                        </span>
                      </button>
                      {completo && !m.revisado && onRevisar && (
                        <button onClick={() => onRevisar(m)} title="Marcar como revisado" aria-label="Marcar como revisado"
                          className="shrink-0 rounded-full border border-emerald-200 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50">
                          <Check size={15} />
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

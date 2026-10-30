'use client'

import { useRef, useState } from 'react'
import { Camera, FileText, Loader2, X } from 'lucide-react'
import { aviso } from '@/components/ui/Avisos'
import { comprimirImagen } from '@/lib/comprimir-imagen'
import { METODOS_PAGO } from '@/lib/finanzas'
import { urlComprobanteTCG } from '@/lib/transportes'

// Piezas que comparten las capturas de Transportes (gastos y trabajos de camiones)

export const leerNumero = (t: string) => {
  const n = parseFloat(t.replace(/[$\s,]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export const claseCampo = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none'

/** Hoja que sube desde abajo en celular y ventana centrada en escritorio */
export function HojaCaptura({ titulo, onCerrar, onEnviar, pie, children }: {
  titulo: React.ReactNode
  onCerrar: () => void
  onEnviar: (e: React.FormEvent) => void
  pie: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 animate-aparecer sm:items-center sm:p-4" onMouseDown={onCerrar}>
      <form onSubmit={onEnviar} onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl animate-subir sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-4">{children}</div>
        <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{pie}</div>
      </form>
    </div>
  )
}

const METODO_CORTO: Record<string, string> = {
  Efectivo: 'Efectivo', 'Tarjeta de débito': 'Débito', 'Tarjeta de crédito': 'Crédito', Transferencia: 'Transferencia',
}

export function MetodoPago({ valor, onCambio, disabled }: { valor: string; onCambio: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {METODOS_PAGO.map((mp) => (
        <button key={mp} type="button" disabled={disabled} onClick={() => onCambio(valor === mp ? '' : mp)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${valor === mp
            ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          {METODO_CORTO[mp]}
        </button>
      ))}
    </div>
  )
}

export function Interruptor({ titulo, detalle, valor, onCambio, disabled }: {
  titulo: string; detalle?: string; valor: boolean; onCambio: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-medium text-gray-900">{titulo}</span>
        {detalle && <span className="block text-xs text-gray-500">{detalle}</span>}
      </span>
      <input type="checkbox" checked={valor} disabled={disabled} onChange={(e) => onCambio(e.target.checked)} className="peer sr-only" />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-brand-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/20" />
    </label>
  )
}

/**
 * Fotos de tickets de una captura. Las que se suben y no se llegan a guardar se borran al cancelar
 * (llamar a descartar()); al guardar, llamar a confirmar().
 */
export function useComprobantes(iniciales: string[] = []) {
  const [comprobantes, setComprobantes] = useState<string[]>(iniciales)
  const [subiendo, setSubiendo] = useState(false)
  const nuevos = useRef<string[]>([])

  async function subir(archivo: File) {
    if (comprobantes.length >= 5) return aviso.error('Máximo 5 fotos')
    setSubiendo(true)
    try {
      const form = new FormData()
      form.append('archivo', await comprimirImagen(archivo))
      const r = await fetch('/api/transportes/comprobantes', { method: 'POST', body: form })
      const j = await r.json()
      if (!r.ok) return aviso.error(j.error ?? 'No se pudo subir la foto')
      nuevos.current.push(j.data.ruta)
      setComprobantes((c) => [...c, j.data.ruta])
    } catch {
      aviso.error('Error de red al subir la foto')
    } finally {
      setSubiendo(false)
    }
  }

  function quitar(ruta: string) {
    setComprobantes((c) => c.filter((x) => x !== ruta))
    if (nuevos.current.includes(ruta)) {
      nuevos.current = nuevos.current.filter((x) => x !== ruta)
      void fetch(urlComprobanteTCG(ruta), { method: 'DELETE' })
    }
  }

  const descartar = () => { for (const ruta of nuevos.current) void fetch(urlComprobanteTCG(ruta), { method: 'DELETE' }) }
  const confirmar = () => { nuevos.current = [] }

  return { comprobantes, subiendo, subir, quitar, descartar, confirmar }
}

export function FotosComprobante({ c, soloLectura = false, titulo = 'Foto del ticket o factura' }: {
  c: ReturnType<typeof useComprobantes>
  soloLectura?: boolean
  titulo?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-gray-500">{titulo}</p>
      <div className="flex flex-wrap gap-2">
        {c.comprobantes.map((ruta) => (
          <div key={ruta} className="relative">
            <a href={urlComprobanteTCG(ruta)} target="_blank" rel="noopener noreferrer"
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {ruta.endsWith('.pdf')
                ? <FileText size={28} className="text-gray-400" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={urlComprobanteTCG(ruta)} alt="Comprobante" className="h-full w-full object-cover" />}
            </a>
            {!soloLectura && (
              <button type="button" onClick={() => c.quitar(ruta)} aria-label="Quitar foto"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-900 p-1 text-white shadow">
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        {!soloLectura && c.comprobantes.length < 5 && (
          <button type="button" onClick={() => input.current?.click()} disabled={c.subiendo}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-700 disabled:opacity-60">
            {c.subiendo ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
            <span className="text-[11px] font-medium">{c.subiendo ? 'Subiendo' : 'Agregar'}</span>
          </button>
        )}
        {soloLectura && c.comprobantes.length === 0 && <p className="text-xs text-gray-400">Sin fotos</p>}
      </div>
      <input ref={input} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void c.subir(f) }} />
    </div>
  )
}

/** Día con nombre: "Hoy", "Ayer" o "Lunes 3 nov" */
export function etiquetaDia(fecha: string, hoy: string) {
  const ayer = new Date(`${hoy}T12:00:00`)
  ayer.setDate(ayer.getDate() - 1)
  const ayerISO = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`
  if (fecha === hoy) return 'Hoy'
  if (fecha === ayerISO) return 'Ayer'
  const t = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short', year: fecha.slice(0, 4) === hoy.slice(0, 4) ? undefined : 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

// Avisos (toasts) y confirmaciones con el estilo del ERP, en lugar de alert()/confirm().
// Se pueden llamar desde cualquier lado (componentes o helpers):
//   aviso.exito('Cotización guardada')
//   if (!(await confirmar({ titulo: '¿Eliminar?', peligro: true }))) return
// <Avisos /> se monta una sola vez en el layout raíz.

type Tipo = 'exito' | 'error' | 'info'
interface Toast { id: number; tipo: Tipo; mensaje: string }
interface Confirmacion {
  titulo: string
  mensaje?: string
  textoConfirmar?: string
  textoCancelar?: string
  peligro?: boolean
  resolver: (ok: boolean) => void
}

let toasts: Toast[] = []
let confirmacion: Confirmacion | null = null
let siguienteId = 1
const oyentes = new Set<() => void>()
let instantanea: { toasts: Toast[]; confirmacion: Confirmacion | null } = { toasts, confirmacion }

function emitir() {
  instantanea = { toasts, confirmacion }
  oyentes.forEach((o) => o())
}

function quitar(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emitir()
}

function mostrar(tipo: Tipo, mensaje: string) {
  const id = siguienteId++
  toasts = [...toasts.slice(-3), { id, tipo, mensaje }] // máximo 4 a la vez
  emitir()
  setTimeout(() => quitar(id), tipo === 'error' ? 6000 : 3500)
}

export const aviso = {
  exito: (mensaje: string) => mostrar('exito', mensaje),
  error: (mensaje: string) => mostrar('error', mensaje),
  info: (mensaje: string) => mostrar('info', mensaje),
}

export function confirmar(opciones: Omit<Confirmacion, 'resolver'>): Promise<boolean> {
  // Si ya hay una abierta, la anterior se cancela
  confirmacion?.resolver(false)
  return new Promise((resolver) => {
    confirmacion = { ...opciones, resolver }
    emitir()
  })
}

function responder(ok: boolean) {
  confirmacion?.resolver(ok)
  confirmacion = null
  emitir()
}

const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o) } }
const leer = () => instantanea
const leerServidor = () => ({ toasts: [] as Toast[], confirmacion: null as Confirmacion | null })

const ESTILO: Record<Tipo, { icono: typeof Info; cls: string }> = {
  exito: { icono: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
  error: { icono: XCircle, cls: 'text-red-600 dark:text-red-400' },
  info: { icono: Info, cls: 'text-brand-600 dark:text-brand-300' },
}

export default function Avisos() {
  const { toasts: lista, confirmacion: conf } = useSyncExternalStore(suscribir, leer, leerServidor)
  const botonRef = useRef<HTMLButtonElement>(null)

  // Teclado en la confirmación: Esc cancela, foco en el botón principal
  useEffect(() => {
    if (!conf) return
    botonRef.current?.focus()
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') responder(false) }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [conf])

  return (
    <>
      {/* Toasts: abajo al centro en celular, abajo a la derecha en escritorio */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end"
      >
        {lista.map((t) => {
          const { icono: Icono, cls } = ESTILO[t.tipo]
          return (
            <div
              key={t.id}
              role={t.tipo === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-black/5 bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] shadow-lg shadow-black/10 animate-subir dark:border-white/10"
            >
              <Icono size={18} className={`mt-0.5 shrink-0 ${cls}`} />
              <p className="flex-1 leading-snug">{t.mensaje}</p>
              <button onClick={() => quitar(t.id)} aria-label="Cerrar aviso"
                className="-mr-1 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text)]">
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Confirmación */}
      {conf && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 animate-aparecer sm:items-center"
          onMouseDown={() => responder(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo"
            className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-5 shadow-2xl animate-subir"
            onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${conf.peligro ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-700'}`}>
                {conf.peligro ? <AlertTriangle size={19} /> : <Info size={19} />}
              </div>
              <div className="pt-1">
                <h2 id="confirmar-titulo" className="font-semibold text-[var(--text)]">{conf.titulo}</h2>
                {conf.mensaje && <p className="mt-1 text-sm text-[var(--text-muted)]">{conf.mensaje}</p>}
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => responder(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]">
                {conf.textoCancelar ?? 'Cancelar'}
              </button>
              <button ref={botonRef} onClick={() => responder(true)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm ${conf.peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}>
                {conf.textoConfirmar ?? (conf.peligro ? 'Eliminar' : 'Aceptar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

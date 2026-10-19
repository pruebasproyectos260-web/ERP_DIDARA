'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'

// Error inesperado dentro del ERP: mensaje claro en español y opción de reintentar,
// en lugar de la pantalla genérica de Next.
export default function ErrorPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle size={22} />
        </div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Algo salió mal</h2>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          No se pudo cargar esta sección. Puede ser un problema de conexión momentáneo.
        </p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-[var(--text-muted)]">Código: {error.digest}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <RotateCcw size={15} /> Reintentar
          </button>
          <Link href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]">
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}

// Esqueleto mientras el servidor carga la página: aparece al instante al navegar.

const COLUMNAS = [10, 18, 30, 14, 16] // ancho relativo de cada columna (%)

function Bloque({ className = '' }: { className?: string }) {
  return <div className={`rounded-lg bg-[var(--border)] animate-brillo ${className}`} />
}

export default function Cargando() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      {/* Encabezado de la página */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Bloque className="h-7 w-48" />
          <Bloque className="h-4 w-28" />
        </div>
        <Bloque className="h-10 w-36 rounded-xl" />
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <Bloque className="h-10 flex-1 max-w-sm rounded-xl" />
        <Bloque className="hidden h-10 w-24 rounded-xl sm:block" />
        <Bloque className="hidden h-10 w-24 rounded-xl sm:block" />
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex gap-6 border-b border-[var(--border)] px-5 py-3.5">
          {COLUMNAS.map((w, i) => (
            <div key={i} style={{ width: `${w}%` }}><Bloque className="h-3" /></div>
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, fila) => (
          <div key={fila} className="flex items-center gap-6 border-b border-[var(--border)] px-5 py-4 last:border-0">
            {COLUMNAS.map((w, i) => (
              <div key={i} style={{ width: `${w}%` }}>
                <Bloque className={`h-3.5 ${i === 2 ? 'w-[85%]' : 'w-full'}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

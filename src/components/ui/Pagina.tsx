import { Search, X } from 'lucide-react'

// Piezas comunes de las páginas de módulos (encabezado, búsqueda, filtros, vacío),
// para que todas se vean y se comporten igual en escritorio y celular.

export function EncabezadoPagina({ titulo, subtitulo, acciones }: {
  titulo: string
  subtitulo?: React.ReactNode
  acciones?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{titulo}</h2>
        {subtitulo && <p className="mt-0.5 text-sm text-gray-500">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
    </div>
  )
}

export function BotonPrincipal({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-900/10 transition-colors hover:bg-brand-700 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  )
}

export function Buscador({ valor, onCambio, placeholder, className = '' }: {
  valor: string
  onCambio: (v: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button type="button" onClick={() => onCambio('')} aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-700">
          <X size={15} />
        </button>
      )}
    </div>
  )
}

/** Grupo de opciones tipo "pastilla" que se desplaza de lado en celular */
export function Segmentado<T extends string>({ opciones, valor, onCambio, etiqueta }: {
  opciones: { value: T; label: string }[]
  valor: T
  onCambio: (v: T) => void
  etiqueta?: React.ReactNode
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {etiqueta && <span className="px-1.5 text-gray-400">{etiqueta}</span>}
        {opciones.map((op) => (
          <button
            key={op.value}
            type="button"
            onClick={() => onCambio(op.value)}
            aria-pressed={valor === op.value}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              valor === op.value ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {op.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function EstadoVacio({ icono, titulo, descripcion, accion }: {
  icono: React.ReactNode
  titulo: string
  descripcion?: string
  accion?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">{icono}</div>
      <p className="font-medium text-gray-900">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-sm text-sm text-gray-500">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  )
}

/** Botón de acción con solo ícono (editar, eliminar, PDF…) */
export function BotonIcono({ titulo, tono = 'neutro', children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  titulo: string
  tono?: 'neutro' | 'marca' | 'peligro' | 'exito' | 'violeta'
}) {
  const tonos = {
    neutro: 'hover:text-gray-900 hover:bg-gray-100',
    marca: 'hover:text-brand-700 hover:bg-brand-50',
    peligro: 'hover:text-red-600 hover:bg-red-50',
    exito: 'hover:text-green-700 hover:bg-green-50',
    violeta: 'hover:text-purple-700 hover:bg-purple-50',
  }
  return (
    <button type="button" title={titulo} aria-label={titulo} {...props}
      className={`rounded-lg p-2 text-gray-400 transition-colors disabled:opacity-50 ${tonos[tono]} ${className}`}>
      {children}
    </button>
  )
}

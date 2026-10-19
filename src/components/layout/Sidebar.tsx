'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { gruposVisibles } from './navegacion'

interface Props {
  nivel: number
  colapsado: boolean
  onAlternarColapso: () => void
  /** Modo panel deslizable en celular */
  movil?: boolean
  onCerrar?: () => void
}

export default function Sidebar({ nivel, colapsado, onAlternarColapso, movil = false, onCerrar }: Props) {
  const pathname = usePathname()
  const grupos = gruposVisibles(nivel)
  const compacto = colapsado && !movil

  return (
    <aside
      className={`relative flex h-full flex-col bg-gradient-to-b from-[#0b2928] to-[#071a19] text-white transition-[width] duration-300 ease-out ${
        movil ? 'w-72' : compacto ? 'w-[76px]' : 'w-64'
      }`}
    >
      {/* Marca */}
      <div className={`flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.07] ${compacto ? 'justify-center px-2' : 'px-5'}`}>
        <Image src="/marca/simbolo.png" alt="" width={24} height={35}
          className="h-8 w-auto shrink-0 brightness-0 invert" priority />
        {!compacto && (
          <div className="min-w-0 leading-none">
            <p className="text-[15px] font-semibold tracking-tight">Didara TI</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-brand-300/80">ERP</p>
          </div>
        )}
        {movil && (
          <button onClick={onCerrar} aria-label="Cerrar menú"
            className="ml-auto rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navegación */}
      <nav className={`flex-1 overflow-y-auto py-4 ${compacto ? 'px-2.5' : 'px-3'}`}>
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="mb-4 last:mb-0">
            {compacto
              ? <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
              : <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/35">{grupo.titulo}</p>}
            <ul className="space-y-0.5">
              {grupo.items.map(({ href, label, icon: Icon }) => {
                const activo = pathname === href || pathname.startsWith(href + '/')
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onCerrar}
                      title={compacto ? label : undefined}
                      aria-current={activo ? 'page' : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors ${
                        compacto ? 'justify-center px-0' : 'px-3'
                      } ${activo
                        ? 'bg-white/[0.09] text-white'
                        : 'text-white/65 hover:bg-white/[0.05] hover:text-white'}`}
                    >
                      {activo && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand-300" />}
                      <Icon size={18} className={`shrink-0 ${activo ? 'text-brand-300' : 'text-white/55 group-hover:text-white/80'}`} />
                      {!compacto && <span className="truncate">{label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pie: colapsar (solo escritorio) */}
      {!movil && (
        <div className="shrink-0 border-t border-white/[0.07] p-2.5">
          <button
            onClick={onAlternarColapso}
            title={compacto ? 'Expandir menú' : 'Colapsar menú'}
            className={`flex w-full items-center gap-3 rounded-lg py-2 text-sm text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white ${compacto ? 'justify-center' : 'px-3'}`}
          >
            {compacto ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} /><span>Colapsar</span></>}
          </button>
        </div>
      )}
    </aside>
  )
}

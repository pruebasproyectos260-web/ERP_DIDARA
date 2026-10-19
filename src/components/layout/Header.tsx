'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, ChevronDown, Moon, Sun, KeyRound, Menu } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import CambiarContrasenaModal from './CambiarContrasenaModal'
import { itemActivo } from './navegacion'
import { alternarTema, useTemaOscuro } from '@/lib/tema'

interface Props {
  user: SupabaseUser
  perfil: { nombre: string; nivel: number } | null
  esContador?: boolean
  onAbrirMenu: () => void
}

const nivelLabel: Record<number, string> = {
  0: 'Super admin',
  1: 'Administrador',
  2: 'Estándar',
  3: 'Restringido',
}

function iniciales(nombre: string) {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U'
}

export default function Header({ user, perfil, esContador, onAbrirMenu }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [modalContrasena, setModalContrasena] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const oscuro = useTemaOscuro()

  // Cerrar el menú de usuario al dar clic fuera o con Esc
  useEffect(() => {
    if (!open) return
    function alClicFuera(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function alTeclear(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [open])

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const modulo = itemActivo(pathname)
  const nombre = perfil?.nombre?.trim() || user.email?.split('@')[0] || 'Usuario'
  const usuario = user.email?.split('@')[0]
  const subLabel = esContador ? 'Contador' : (nivelLabel[perfil?.nivel ?? 2] ?? 'Estándar')

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 backdrop-blur sm:px-6">
      {/* Menú (celular) */}
      <button onClick={onAbrirMenu} aria-label="Abrir menú"
        className="-ml-1 rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] lg:hidden">
        <Menu size={20} />
      </button>

      {/* Módulo actual */}
      <div className="flex min-w-0 items-center gap-2.5">
        {modulo && (
          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 sm:flex">
            <modulo.icon size={17} />
          </span>
        )}
        <h1 className="truncate text-[15px] font-semibold text-[var(--text)]">{modulo?.label ?? 'Didara ERP'}</h1>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Tema */}
        <button onClick={alternarTema} title={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
          {oscuro ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Usuario */}
        <div className="relative" ref={menuRef}>
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
            className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 text-sm transition-colors hover:bg-[var(--surface-2)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white shadow-sm">
              {iniciales(nombre)}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[180px] truncate font-medium text-[var(--text)]">{nombre}</span>
              <span className="block text-xs text-[var(--text-muted)]">{subLabel}</span>
            </span>
            <ChevronDown size={15} className={`hidden text-[var(--text-muted)] transition-transform sm:block ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div role="menu"
              className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1.5 shadow-xl shadow-black/10 animate-subir">
              <div className="border-b border-[var(--border)] px-4 pb-2.5 pt-1.5">
                <p className="truncate text-sm font-medium text-[var(--text)]">{nombre}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{usuario ? `@${usuario}` : ''} · {subLabel}</p>
              </div>
              <button role="menuitem" onClick={() => { setOpen(false); setModalContrasena(true) }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]">
                <KeyRound size={15} className="text-[var(--text-muted)]" />
                Cambiar contraseña
              </button>
              <button role="menuitem" onClick={cerrarSesion}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400">
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {modalContrasena && <CambiarContrasenaModal onClose={() => setModalContrasena(false)} />}
    </header>
  )
}

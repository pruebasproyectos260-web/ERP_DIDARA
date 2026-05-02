'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, ChevronDown, Moon, Sun } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface Props {
  user: SupabaseUser
  perfil: { nombre: string; nivel: number } | null
  esContador?: boolean
}

const nivelLabel: Record<number, string> = {
  0: 'Admin',
  1: 'Admin',
  2: 'Estándar',
  3: 'Restringido',
}

export default function Header({ user, perfil, esContador }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('darkMode') === 'true'
    setDarkMode(saved)
    document.body.classList.toggle('dark-mode', saved)
  }, [])

  function toggleDark() {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('darkMode', String(next))
    document.body.classList.toggle('dark-mode', next)
  }

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const subLabel = esContador ? 'Contador' : (nivelLabel[perfil?.nivel ?? 2] ?? 'Estándar')

  return (
    <header className="h-14 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-end px-6 gap-3">

      {/* Dark mode toggle */}
      <button
        onClick={toggleDark}
        title={darkMode ? 'Modo claro' : 'Modo oscuro'}
        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
      >
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-sm text-[var(--text)] hover:text-[var(--text)] transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
            {(perfil?.nombre ?? user.email ?? 'U')[0].toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p className="font-medium leading-none">{perfil?.nombre ?? user.email}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{subLabel}</p>
          </div>
          <ChevronDown size={14} className="text-[var(--text-muted)]" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-[var(--surface)] rounded-lg shadow-lg border border-[var(--border)] py-1 z-50">
            <div className="px-4 py-2 border-b border-[var(--border)]">
              <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
            </div>
            <button
              onClick={cerrarSesion}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, User, ChevronDown } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface Props {
  user: SupabaseUser
  perfil: { nombre: string; nivel: number } | null
}

const nivelLabel: Record<number, string> = {
  0: 'Admin',
  1: 'Admin',
  2: 'Estándar',
  3: 'Restringido',
}

export default function Header({ user, perfil }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6 gap-4">
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
            {(perfil?.nombre ?? user.email ?? 'U')[0].toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p className="font-medium leading-none">{perfil?.nombre ?? user.email}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {nivelLabel[perfil?.nivel ?? 2]}
            </p>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
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

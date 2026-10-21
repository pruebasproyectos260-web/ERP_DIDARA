'use client'

import { useEffect, useState } from 'react'
import type { UsuarioSesion } from '@/lib/supabase/server'
import Sidebar from './Sidebar'
import Header from './Header'
import { COOKIE_SIDEBAR } from './navegacion'
import { useNovedadesTickets } from './useNovedadesTickets'
import { useSesionCaducada } from './useSesionCaducada'

interface Props {
  user: UsuarioSesion
  perfil: { nombre: string; nivel: number } | null
  esContador: boolean
  /** Viene de una cookie leída en el servidor: evita que el menú "salte" al cargar */
  colapsadoInicial: boolean
  /** Números junto a un módulo del menú (p. ej. tickets activos) */
  contadores?: Record<string, number>
  children: React.ReactNode
}

export default function Shell({ user, perfil, esContador, colapsadoInicial, contadores: contadoresIniciales, children }: Props) {
  const nivel = perfil?.nivel ?? 2
  const [colapsado, setColapsado] = useState(colapsadoInicial)
  const [menuMovil, setMenuMovil] = useState(false)
  const ticketsActivos = useNovedadesTickets(contadoresIniciales?.['/tickets'] ?? 0)
  useSesionCaducada()
  const contadores = { ...contadoresIniciales, '/tickets': ticketsActivos }

  function alternarColapso() {
    const siguiente = !colapsado
    setColapsado(siguiente)
    document.cookie = `${COOKIE_SIDEBAR}=${siguiente ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
  }

  // Panel del celular: Esc cierra y no se desplaza la página de fondo
  useEffect(() => {
    if (!menuMovil) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuMovil(false) }
    document.addEventListener('keydown', alTeclear)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflowPrevio
    }
  }, [menuMovil])

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Menú fijo en escritorio */}
      <div className="hidden shrink-0 lg:block">
        <Sidebar nivel={nivel} colapsado={colapsado} onAlternarColapso={alternarColapso} contadores={contadores} />
      </div>

      {/* Menú deslizable en celular / tableta */}
      {menuMovil && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-black/50 animate-aparecer" onClick={() => setMenuMovil(false)} />
          <div className="absolute inset-y-0 left-0 shadow-2xl animate-deslizar">
            <Sidebar nivel={nivel} colapsado={false} onAlternarColapso={alternarColapso} contadores={contadores} movil onCerrar={() => setMenuMovil(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} perfil={perfil} esContador={esContador} onAbrirMenu={() => setMenuMovil(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

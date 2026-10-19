'use client'

import { useSyncExternalStore } from 'react'

// El tema vive en la clase `dark-mode` del <body> (la aplica el script anti-parpadeo
// del layout raíz y el botón del Header). Este hook la observa sin duplicar estado.

function suscribir(aviso: () => void) {
  const obs = new MutationObserver(aviso)
  obs.observe(document.body, { attributes: true, attributeFilter: ['class'] })
  return () => obs.disconnect()
}

export const temaOscuroActivo = () => document.body.classList.contains('dark-mode')

export function useTemaOscuro(): boolean {
  return useSyncExternalStore(suscribir, temaOscuroActivo, () => false)
}

export function alternarTema() {
  const siguiente = !temaOscuroActivo()
  document.body.classList.toggle('dark-mode', siguiente)
  try { localStorage.setItem('darkMode', String(siguiente)) } catch { /* modo privado */ }
}

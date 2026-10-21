'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * ¿La pantalla cumple la media query? `null` en el servidor y durante la hidratación (aún no se sabe):
 * así el HTML inicial puede traer ambas vistas (celular/escritorio) y, ya en el navegador,
 * se deja solo la que corresponde (la mitad de elementos e imágenes).
 */
export function useMediaQuery(consulta: string): boolean | null {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(consulta)
      m.addEventListener('change', avisar)
      return () => m.removeEventListener('change', avisar)
    },
    () => window.matchMedia(consulta).matches,
    () => null,
  )
}

/**
 * Lista larga por partes: muestra los primeros `porTanda` elementos y agrega más
 * cuando el usuario se acerca al final. La página queda ligera aunque haya cientos de filas.
 */
export function useCargaProgresiva<T>(lista: T[], porTanda = 60) {
  const [limite, setLimite] = useState(porTanda)
  const centinela = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = centinela.current
    if (!el || limite >= lista.length) return
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setLimite((n) => n + porTanda)
    }, { rootMargin: '800px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [limite, lista.length, porTanda])

  return { visibles: lista.slice(0, limite), centinela, restantes: Math.max(0, lista.length - limite) }
}

'use client'

import { useEffect } from 'react'
import { aviso } from '@/components/ui/Avisos'

/**
 * Si la sesión se cierra mientras la página sigue abierta (caducó, o se cerró desde otro lado),
 * cualquier llamada a /api/ responde 401: se avisa con un mensaje claro y se manda a iniciar sesión,
 * en lugar de dejar errores sueltos en cada formulario.
 */
export function useSesionCaducada() {
  useEffect(() => {
    const original = window.fetch
    let avisado = false
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const respuesta = await original(...args)
      if (respuesta.status === 401 && !avisado) {
        const destino = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url
        const ruta = destino.startsWith(window.location.origin) ? destino.slice(window.location.origin.length) : destino
        if (ruta.startsWith('/api/')) {
          avisado = true
          aviso.error('Tu sesión se cerró. Vuelve a iniciar sesión.')
          setTimeout(() => { window.location.href = '/login' }, 2000)
        }
      }
      return respuesta
    }
    return () => { window.fetch = original }
  }, [])
}

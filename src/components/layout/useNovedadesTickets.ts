'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { aviso } from '@/components/ui/Avisos'
import { sincronizarAvisos } from '@/lib/push-cliente'

// Avisos en vivo de la mesa de ayuda mientras el ERP está abierto:
// cada 30 s (solo con la pestaña visible) pregunta qué hay nuevo, muestra un aviso
// en pantalla y mantiene al día el contador del menú.
//
// Eventos de ventana:
//   'tickets:cambio'     → alguien cambió tickets en esta pestaña: revisar ya (contador)
//   'tickets:novedades'  → llegaron tickets/respuestas; detail.ids = tickets afectados

const CADA_MS = 30_000

interface Evento { clave: string; tipo: 'nuevo' | 'respuesta'; ticketId: number; folio: string; texto: string; urgente: boolean }

export function useNovedadesTickets(activosIniciales: number) {
  const router = useRouter()
  const [activos, setActivos] = useState(activosIniciales)

  useEffect(() => {
    let desde: string | null = null // la primera revisión solo marca el punto de partida
    let cancelado = false
    let revisando = false
    const vistos = new Set<string>()

    async function revisar() {
      if (revisando || document.visibilityState !== 'visible') return
      revisando = true
      try {
        const r = await fetch(`/api/tickets/novedades${desde ? `?desde=${encodeURIComponent(desde)}` : ''}`)
        if (!r.ok || cancelado) return
        const { data } = await r.json() as { data: { ahora: string; activos: number; eventos: Evento[] } }
        if (cancelado) return
        setActivos(data.activos)

        const nuevos = desde ? data.eventos.filter((e) => !vistos.has(e.clave)) : []
        data.eventos.forEach((e) => vistos.add(e.clave))
        desde = data.ahora
        if (!nuevos.length) return

        for (const e of nuevos.slice(0, 3)) {
          aviso.notificacion({
            titulo: e.tipo === 'nuevo' ? `Nuevo ticket ${e.folio}` : `Respuesta en ${e.folio}`,
            mensaje: e.texto,
            urgente: e.urgente,
            accion: { texto: 'Ver ticket', alHacer: () => router.push(`/tickets?ver=${e.ticketId}`) },
          })
        }
        if (nuevos.length > 3) aviso.info(`Y ${nuevos.length - 3} avisos más en la mesa de ayuda`)
        window.dispatchEvent(new CustomEvent('tickets:novedades', { detail: { ids: nuevos.map((e) => e.ticketId) } }))
      } catch {
        // sin red: se reintenta en la siguiente vuelta
      } finally {
        revisando = false
      }
    }

    void revisar()
    const intervalo = setInterval(revisar, CADA_MS)
    const alVolver = () => { if (document.visibilityState === 'visible') void revisar() }
    const alCambiar = () => { void revisar() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('tickets:cambio', alCambiar)

    // Al tocar una notificación push con el ERP abierto, el service worker pide abrir el ticket aquí
    const alMensaje = (e: MessageEvent) => {
      if (e.data?.tipo === 'abrir' && typeof e.data.url === 'string' && e.data.url.startsWith('/')) router.push(e.data.url)
    }
    navigator.serviceWorker?.addEventListener('message', alMensaje)
    void sincronizarAvisos()

    return () => {
      cancelado = true
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('tickets:cambio', alCambiar)
      navigator.serviceWorker?.removeEventListener('message', alMensaje)
    }
  }, [router])

  return activos
}

/** Avisar al contador del menú que algo cambió en esta pestaña */
export const avisarCambioTickets = () => window.dispatchEvent(new Event('tickets:cambio'))

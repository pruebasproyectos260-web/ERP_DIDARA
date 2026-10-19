'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, BellRing, Loader2, Send } from 'lucide-react'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { activarAvisos, desactivarAvisos, estadoAvisos, type EstadoAvisos } from '@/lib/push-cliente'

/** Activa los avisos push (notificaciones del sistema) en el dispositivo actual */
export default function BotonAvisos() {
  const [estado, setEstado] = useState<EstadoAvisos>('cargando')
  const [ocupado, setOcupado] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    estadoAvisos().then(setEstado).catch(() => setEstado('no-soportado'))
  }, [])

  useEffect(() => {
    if (!menu) return
    const alClicFuera = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', alClicFuera)
    return () => document.removeEventListener('mousedown', alClicFuera)
  }, [menu])

  async function activar() {
    setOcupado(true)
    try {
      await activarAvisos()
      setEstado('activo')
      aviso.exito('Avisos activados en este dispositivo')
      void fetch('/api/push/prueba', { method: 'POST' })
    } catch (e) {
      aviso.error(e instanceof Error ? e.message : 'No se pudieron activar los avisos')
      setEstado(await estadoAvisos().catch(() => 'inactivo' as const))
    } finally {
      setOcupado(false)
    }
  }

  async function probar() {
    setMenu(false)
    const r = await fetch('/api/push/prueba', { method: 'POST' }).then((x) => x.json()).catch(() => null)
    if (r?.data?.enviados) aviso.exito('Aviso de prueba enviado: debe aparecer en unos segundos')
    else aviso.error('No se pudo enviar el aviso de prueba. Desactiva y vuelve a activar los avisos.')
  }

  async function desactivar() {
    setMenu(false)
    if (!(await confirmar({ titulo: '¿Desactivar los avisos en este dispositivo?', mensaje: 'Dejarán de llegarte notificaciones de tickets aquí. Puedes volver a activarlas cuando quieras.', textoConfirmar: 'Desactivar' }))) return
    await desactivarAvisos().catch(() => {})
    setEstado('inactivo')
    aviso.info('Avisos desactivados en este dispositivo')
  }

  const base = 'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-60'

  if (estado === 'cargando' || estado === 'no-soportado') return null

  if (estado === 'instalar-iphone') {
    return (
      <button onClick={() => confirmar({
        titulo: 'Avisos en iPhone',
        mensaje: 'Apple solo permite avisos si el ERP está en tu pantalla de inicio: en Safari toca Compartir → "Agregar a pantalla de inicio", abre Didara ERP desde ese ícono y activa los avisos aquí.',
        textoConfirmar: 'Entendido', textoCancelar: 'Cerrar',
      })} className={`${base} border-gray-200 bg-white text-gray-600 hover:bg-gray-50`}>
        <Bell size={16} /><span className="hidden sm:inline">Activar avisos</span>
      </button>
    )
  }

  if (estado === 'bloqueado') {
    return (
      <button onClick={() => aviso.error('Los avisos están bloqueados en este navegador. Permite las notificaciones de este sitio (candado junto a la dirección → Notificaciones) y recarga la página.')}
        className={`${base} border-gray-200 bg-white text-gray-400 hover:bg-gray-50`} title="Avisos bloqueados en este navegador">
        <BellOff size={16} /><span className="hidden sm:inline">Avisos bloqueados</span>
      </button>
    )
  }

  if (estado === 'inactivo') {
    return (
      <button onClick={activar} disabled={ocupado} className={`${base} border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100`}
        title="Recibe una notificación en este dispositivo cuando llegue un ticket">
        {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
        <span className="hidden sm:inline">Activar avisos</span>
      </button>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu"
        className={`${base} border-gray-200 bg-white text-brand-700 hover:bg-gray-50`} title="Avisos activos en este dispositivo">
        <BellRing size={16} /><span className="hidden sm:inline">Avisos activos</span>
      </button>
      {menu && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg animate-aparecer">
          <p className="px-3.5 py-2 text-xs text-gray-500">Recibes las notificaciones de la mesa de ayuda en este dispositivo.</p>
          <button role="menuitem" onClick={probar} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
            <Send size={15} className="text-brand-600" /> Enviar aviso de prueba
          </button>
          <button role="menuitem" onClick={desactivar} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50">
            <BellOff size={15} /> Desactivar en este dispositivo
          </button>
        </div>
      )}
    </div>
  )
}

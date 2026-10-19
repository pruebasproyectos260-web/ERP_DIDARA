'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, LifeBuoy, Loader2, Mail, MessageCircle, X } from 'lucide-react'
import { aviso } from './Avisos'

// Ventana para compartir el enlace del portal de soporte de un cliente
// (copiar, mandar por WhatsApp o enviar por correo).

export default function PortalCliente({ clienteId, emailSugerido, onCerrar }: {
  clienteId: number
  emailSugerido?: string | null
  onCerrar: () => void
}) {
  const [datos, setDatos] = useState<{ cliente: string; url: string } | null>(null)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [email, setEmail] = useState(emailSugerido ?? '')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/clientes/${clienteId}/portal-link`)
      .then(async (r) => {
        const j = await r.json()
        if (cancelado) return
        if (!r.ok) setError(j.error ?? 'No se pudo generar el enlace')
        else setDatos(j.data)
      })
      .catch(() => { if (!cancelado) setError('Error de red') })
    return () => { cancelado = true }
  }, [clienteId])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  async function copiar() {
    if (!datos) return
    try {
      await navigator.clipboard.writeText(datos.url)
      setCopiado(true)
      aviso.exito('Enlace copiado')
    } catch {
      aviso.info('Selecciona el enlace y cópialo manualmente')
    }
  }

  async function enviarCorreo(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/portal-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      })
      const j = await r.json()
      if (!r.ok) return aviso.error(j.error ?? 'No se pudo enviar el correo')
      aviso.exito(`Enlace enviado a ${email}`)
    } catch {
      aviso.error('Error de red')
    } finally {
      setEnviando(false)
    }
  }

  const textoWhatsapp = datos
    ? `Hola, este es el portal de soporte de ${datos.cliente} con Didara TI. Desde aquí pueden levantar tickets cuando tengan algún problema técnico y ver su seguimiento: ${datos.url}`
    : ''

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-aparecer sm:items-center sm:p-4" onMouseDown={onCerrar}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl animate-subir sm:rounded-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <LifeBuoy size={17} className="text-brand-600" />
            <h3 className="font-semibold text-gray-900">Portal de soporte</h3>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? <p className="text-sm text-red-600">{error}</p> : !datos ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Enlace exclusivo de <strong>{datos.cliente}</strong>. Los tickets que levanten desde aquí quedan registrados a su nombre automáticamente.
              </p>
              <input readOnly value={datos.url} onFocus={(e) => e.target.select()}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={copiar}
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                  {copiado ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent(textoWhatsapp)}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              </div>
              <form onSubmit={enviarCorreo} className="border-t border-gray-100 pt-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Enviar por correo</label>
                <div className="flex gap-2">
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@cliente.com"
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10" />
                  <button type="submit" disabled={enviando}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60">
                    {enviando ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Enviar
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-gray-400">Se envía con copia a direccion@didara-ti.com</p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

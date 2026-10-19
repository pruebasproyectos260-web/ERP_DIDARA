'use client'

import { useState } from 'react'
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react'

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function CambiarContrasenaModal({ onClose }: { onClose: () => void }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [ver, setVer] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres')
    if (nueva !== confirmar) return setError('La confirmación no coincide con la nueva contraseña')

    setGuardando(true)
    try {
      const res = await fetch('/api/perfil/contrasena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual, nueva }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return setError(json.error ?? 'No se pudo cambiar la contraseña')
      setListo(true)
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const tipo = ver ? 'text' : 'password'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">Cambiar mi contraseña</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {listo ? (
          <div className="px-5 py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check size={22} className="text-green-600" />
            </div>
            <p className="text-sm text-gray-700">Tu contraseña se cambió correctamente.</p>
            <p className="text-xs text-gray-500">Guárdala en el administrador de contraseñas de tu navegador.</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={guardar} className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
              <input type={tipo} value={actual} onChange={(e) => setActual(e.target.value)} required
                autoComplete="current-password" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
              <div className="relative">
                <input type={tipo} value={nueva} onChange={(e) => setNueva(e.target.value)} required minLength={8}
                  autoComplete="new-password" className={inputCls} />
                <button type="button" onClick={() => setVer((v) => !v)} title={ver ? 'Ocultar' : 'Mostrar'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                  {ver ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
              <input type={tipo} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required
                autoComplete="new-password" className={inputCls} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
                Cancelar
              </button>
              <button type="submit" disabled={guardando}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg">
                {guardando && <Loader2 size={14} className="animate-spin" />}
                Guardar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Lock, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const inputCls =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] py-3 pl-10 pr-3 text-sm text-[var(--text)] ' +
  'placeholder:text-[var(--text-muted)] transition-shadow focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15'

export default function LoginPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Convertir nombre de usuario a email interno
    const email = `${usuario.trim().toLowerCase()}@didara-erp.local`

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Usuario o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-dvh bg-[var(--bg)]">
      {/* Panel de marca (escritorio) */}
      <div className="relative hidden w-[46%] max-w-[640px] overflow-hidden bg-gradient-to-br from-[#0e3836] via-[#0b2928] to-[#061716] lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Anillos decorativos inspirados en el logo */}
        <div aria-hidden className="pointer-events-none absolute -right-40 top-1/2 h-[560px] w-[560px] -translate-y-1/2 rounded-full border-[28px] border-brand-500/10" />
        <div aria-hidden className="pointer-events-none absolute -right-16 top-1/2 h-[340px] w-[340px] -translate-y-1/2 rounded-full border-[22px] border-brand-400/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />

        <div className="relative flex items-center gap-3 text-white">
          <Image src="/marca/simbolo.png" alt="" width={30} height={44} className="h-10 w-auto brightness-0 invert" priority />
          <div className="leading-none">
            <p className="text-lg font-semibold tracking-tight">Didara TI</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-brand-300/80">ERP</p>
          </div>
        </div>

        <div className="relative max-w-md text-white">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Cotizaciones, servicios e inventario en un solo lugar.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            Sistema de gestión de Didara TI para clientes, reportes de servicio, agenda y finanzas.
          </p>
        </div>

        <p className="relative text-xs text-white/40">Didara TI © {new Date().getFullYear()}</p>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <Image src="/marca/logo.png" alt="Didara TI" width={56} height={98} className="mb-5 h-20 w-auto lg:hidden" priority />
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Bienvenido</h1>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">Inicia sesión con tu usuario de Didara ERP</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="usuario" className="mb-1.5 block text-sm font-medium text-[var(--text-label)]">Usuario</label>
              <div className="relative">
                <User size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="usuario"
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={inputCls}
                  placeholder="tu_usuario"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--text-label)]">Contraseña</label>
              <div className="relative">
                <Lock size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="password"
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={`${inputCls} pr-11`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {verPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-900/20 transition-colors hover:bg-brand-700 disabled:opacity-70"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Iniciando sesión…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-[var(--text-muted)] lg:hidden">
            Didara TI © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}

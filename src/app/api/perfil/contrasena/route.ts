import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requireNivel } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

const esquema = z.object({
  actual: z.string().min(1, 'Escribe tu contraseña actual'),
  nueva: z.string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(72, 'La nueva contraseña no puede tener más de 72 caracteres'),
}).refine((d) => d.actual !== d.nueva, { message: 'La nueva contraseña debe ser distinta a la actual', path: ['nueva'] })

// Cualquier usuario cambia SU contraseña, confirmando la actual.
export async function POST(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth

  const parsed = esquema.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { actual, nueva } = parsed.data

  // Verificar la contraseña actual con un cliente aislado (no toca las cookies del navegador)
  const verificador = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error: errorLogin } = await verificador.auth.signInWithPassword({ email: auth.email, password: actual })
  if (errorLogin) {
    return NextResponse.json({ error: 'La contraseña actual no es correcta' }, { status: 400 })
  }

  // Supabase cierra TODAS las sesiones del usuario al cambiar la contraseña (bien: si alguien
  // tenía su sesión abierta en otro equipo, la pierde)...
  const { error } = await auth.supabase.auth.admin.updateUserById(auth.userId, { password: nueva })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ...así que se abre una sesión nueva aquí para no sacarlo del ERP (las cookies van en esta respuesta)
  const sesionNavegador = await createClient()
  await sesionNavegador.auth.signInWithPassword({ email: auth.email, password: nueva })

  await registrarActividad(auth, 'cambiar_contrasena', 'usuarios', auth.userId, 'Cambió su propia contraseña')
  return NextResponse.json({ ok: true })
}

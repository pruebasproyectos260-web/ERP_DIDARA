import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NIVEL } from '@/lib/nivel'

export interface Sesion {
  userId: string
  email: string
  nivel: number
  nombre: string
  esContador: boolean
  supabase: ReturnType<typeof createServiceClient>
}

/**
 * Valida la sesión y el nivel del usuario en el servidor.
 * Las API routes usan service role (se salta RLS), así que este es el único
 * control real de permisos: ocultar botones en la UI no basta.
 *
 * Uso:
 *   const auth = await requireNivel(NIVEL.ESTANDAR)
 *   if (auth instanceof NextResponse) return auth
 */
export async function requireNivel(nivelMaximo: number = NIVEL.RESTRINGIDO): Promise<Sesion | NextResponse> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nombre, nivel, es_contador, activo')
    .eq('id', user.id)
    .single()

  if (!perfil || !perfil.activo) {
    return NextResponse.json({ error: 'Tu cuenta está desactivada' }, { status: 403 })
  }
  if (perfil.nivel > nivelMaximo) {
    return NextResponse.json({ error: 'No tienes permiso para realizar esta acción' }, { status: 403 })
  }

  return {
    userId: user.id,
    email: user.email ?? '',
    nivel: perfil.nivel,
    nombre: perfil.nombre,
    esContador: perfil.es_contador,
    supabase,
  }
}

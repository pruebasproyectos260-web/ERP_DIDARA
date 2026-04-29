import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()
  const { username, password, nombre, correo, nivel, es_contador } = await req.json()

  if (!username || !password || !nombre) {
    return NextResponse.json({ error: 'usuario, contraseña y nombre son requeridos' }, { status: 400 })
  }

  // Construir email interno a partir del username
  const usernameClean = username.trim().toLowerCase().replace(/\s+/g, '_')
  const email = `${usernameClean}@didara-erp.local`

  // Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  // Actualizar perfil con nivel, nombre y username (el trigger ya creó la fila)
  const { data, error } = await supabase
    .from('usuarios')
    .update({ nombre, nivel: nivel ?? 2, es_contador: es_contador ?? false, username: usernameClean, correo: correo || null })
    .eq('id', authData.user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

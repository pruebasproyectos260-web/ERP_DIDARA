import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { errorValidacion, leerJson } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function GET() {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase, nivel } = auth

  // Agenda y Pendientes usan esta lista para elegir responsables:
  // quien no es admin solo recibe id y nombre.
  const columnas = nivel <= NIVEL.ADMIN ? '*' : 'id, nombre'

  const { data, error } = await supabase
    .from('usuarios')
    .select(columnas)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

const esquemaNuevo = z.object({
  username: z.string().trim().toLowerCase()
    .transform((u) => u.replace(/\s+/g, '_'))
    .pipe(z.string()
      .min(2, 'El usuario debe tener al menos 2 caracteres')
      .max(40, 'El usuario no puede tener más de 40 caracteres')
      .regex(/^[a-z0-9._-]+$/, 'El usuario solo puede tener letras sin acento, números, punto, guion y guion bajo')),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede tener más de 72 caracteres'),
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(120),
  correo: z.union([z.literal(''), z.email('El correo no es válido')]).nullish(),
  nivel: z.number().int().min(0).max(3).default(NIVEL.ESTANDAR),
  es_contador: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth

  const parsed = esquemaNuevo.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { username, password, nombre, correo, nivel, es_contador } = parsed.data

  if (nivel === NIVEL.SUPER_ADMIN && auth.nivel !== NIVEL.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Solo el super admin puede crear usuarios nivel 0' }, { status: 403 })
  }

  // Construir email interno a partir del username
  const email = `${username}@didara-erp.local`

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
    .update({ nombre, nivel, es_contador, username, correo: correo || null })
    .eq('id', authData.user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'crear', 'usuarios', data.id, `${nombre} (@${username}, nivel ${nivel})`)
  return NextResponse.json({ data }, { status: 201 })
}

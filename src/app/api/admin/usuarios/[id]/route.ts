import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireNivel, type Sesion } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { errorValidacion, leerJson } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

const esquemaEdicion = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(120).optional(),
  nivel: z.number().int().min(0).max(3).optional(),
  es_contador: z.boolean().optional(),
  correo: z.union([z.literal(''), z.email('El correo no es válido')]).nullish(),
  nueva_contrasena: z.union([
    z.literal(''),
    z.string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(72, 'La contraseña no puede tener más de 72 caracteres'),
  ]).optional(),
})

/** Un admin nivel 1 no puede tocar cuentas nivel 0. */
async function validarObjetivo(sesion: Sesion, id: string) {
  const { data: objetivo } = await sesion.supabase
    .from('usuarios')
    .select('nivel')
    .eq('id', id)
    .single()

  if (!objetivo) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (objetivo.nivel === NIVEL.SUPER_ADMIN && sesion.nivel !== NIVEL.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Solo el super admin puede modificar esta cuenta' }, { status: 403 })
  }
  return null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

  const parsed = esquemaEdicion.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { nombre, nivel, es_contador, correo, nueva_contrasena } = parsed.data

  const rechazo = await validarObjetivo(auth, id)
  if (rechazo) return rechazo

  if (nivel === NIVEL.SUPER_ADMIN && auth.nivel !== NIVEL.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Solo el super admin puede asignar el nivel 0' }, { status: 403 })
  }
  if (id === auth.userId && nivel !== undefined && nivel !== auth.nivel) {
    return NextResponse.json({ error: 'No puedes cambiar tu propio nivel' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  if (nombre !== undefined) updateData.nombre = nombre
  if (nivel !== undefined) updateData.nivel = nivel
  if (es_contador !== undefined) updateData.es_contador = es_contador
  if (correo !== undefined) updateData.correo = correo || null

  const { data, error } = await supabase
    .from('usuarios')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (nueva_contrasena) {
    const { error: authError } = await supabase.auth.admin.updateUserById(id, {
      password: nueva_contrasena,
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const cambios = [
    nivel !== undefined && `nivel ${nivel}`,
    es_contador !== undefined && `contador: ${es_contador ? 'sí' : 'no'}`,
    nueva_contrasena && 'contraseña restablecida',
  ].filter(Boolean).join(', ')
  await registrarActividad(auth, nueva_contrasena ? 'cambiar_contrasena' : 'editar', 'usuarios', id, `${data.nombre}${cambios ? ` — ${cambios}` : ''}`)

  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

  if (id === auth.userId) {
    return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 403 })
  }
  const rechazo = await validarObjetivo(auth, id)
  if (rechazo) return rechazo

  const { data, error } = await supabase
    .from('usuarios')
    .update({ activo: false })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: authError } = await supabase.auth.admin.updateUserById(id, {
    ban_duration: '876600h',
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  await registrarActividad(auth, 'desactivar', 'usuarios', id, data.nombre)
  return NextResponse.json({ data })
}

import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson, soloEnviados } from '@/lib/campos'
import { esquemaCambioEmpleado } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await leerJson(req)
  const parsed = esquemaCambioEmpleado.safeParse(body)
  if (!parsed.success) return errorValidacion(parsed.error)
  const cambios = soloEnviados(parsed.data, body)

  const { data: actual } = await auth.supabase.from('tcg_empleados').select('fecha_ingreso, fecha_baja').eq('id', id).single()
  if (!actual) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
  const ingreso = cambios.fecha_ingreso !== undefined ? cambios.fecha_ingreso : actual.fecha_ingreso
  const baja = cambios.fecha_baja !== undefined ? cambios.fecha_baja : actual.fecha_baja
  if (ingreso && baja && baja < ingreso) return NextResponse.json({ error: 'La baja no puede ser antes del ingreso' }, { status: 400 })

  const { data, error } = await auth.supabase.from('tcg_empleados').update(cambios).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ data })
}

/** Borra al empleado y sus marcas de asistencia (para conservar su historial, mejor darlo de baja) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const { error } = await auth.supabase.from('tcg_empleados').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

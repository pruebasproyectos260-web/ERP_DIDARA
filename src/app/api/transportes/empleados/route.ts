import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { esquemaEmpleado, faltaMigracionTCG } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

export async function GET() {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { data, error } = await auth.supabase.from('tcg_empleados').select('*').order('activo', { ascending: false }).order('nombre')
  if (error) {
    if (faltaMigracionTCG(error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: 'No se pudieron cargar los empleados' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const parsed = esquemaEmpleado.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { data, error } = await auth.supabase.from('tcg_empleados').insert(parsed.data).select('*').single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

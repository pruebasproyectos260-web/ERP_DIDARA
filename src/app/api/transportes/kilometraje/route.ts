import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { esquemaKilometraje, faltaMigracionTCG } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

/** Lecturas del odómetro de un vehículo (las capturadas a mano; las de los trabajos van aparte) */
export async function GET(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const camion = Number(req.nextUrl.searchParams.get('camion_id'))
  if (!(camion > 0)) return NextResponse.json({ error: 'Falta el vehículo' }, { status: 400 })
  const { data, error } = await auth.supabase.from('tcg_kilometraje').select('*').eq('camion_id', camion)
    .order('fecha', { ascending: false }).order('km', { ascending: false }).limit(200)
  if (error) {
    if (faltaMigracionTCG(error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: 'No se pudo cargar el kilometraje' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const parsed = esquemaKilometraje.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { data: vehiculo } = await auth.supabase.from('tcg_camiones').select('id').eq('id', parsed.data.camion_id).single()
  if (!vehiculo) return NextResponse.json({ error: 'El vehículo no existe' }, { status: 400 })
  const { data, error } = await auth.supabase.from('tcg_kilometraje').insert(parsed.data).select('*').single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!(id > 0)) return NextResponse.json({ error: 'Falta la lectura' }, { status: 400 })
  const { error } = await auth.supabase.from('tcg_kilometraje').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

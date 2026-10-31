import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { esquemaDocumento, faltaMigracionTCG } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

/** Documentos de un vehículo (seguro, verificaciones, tarjeta de circulación…) */
export async function GET(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const camion = Number(req.nextUrl.searchParams.get('camion_id'))
  if (!(camion > 0)) return NextResponse.json({ error: 'Falta el vehículo' }, { status: 400 })
  const { data, error } = await auth.supabase.from('tcg_documentos').select('*').eq('camion_id', camion)
    .order('vence', { ascending: true, nullsFirst: false }).order('nombre')
  if (error) {
    if (faltaMigracionTCG(error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: 'No se pudieron cargar los documentos' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const parsed = esquemaDocumento.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { data: vehiculo } = await auth.supabase.from('tcg_camiones').select('id').eq('id', parsed.data.camion_id).single()
  if (!vehiculo) return NextResponse.json({ error: 'El vehículo no existe' }, { status: 400 })
  const { data, error } = await auth.supabase.from('tcg_documentos').insert(parsed.data).select('*').single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

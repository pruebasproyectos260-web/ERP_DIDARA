import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson, limpiarBusqueda } from '@/lib/campos'
import { esquemaTrabajo, faltaMigracionTCG, TIPOS_TRABAJO } from '@/lib/transportes'
import { SELECT_TRABAJO, sincronizarGastoTrabajo, soloSuperAdmin } from '@/lib/transportes-servidor'

export async function GET(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const sp = req.nextUrl.searchParams

  let consulta = auth.supabase.from('tcg_trabajos').select(SELECT_TRABAJO)
    .order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
  const camion = Number(sp.get('camion_id'))
  if (camion > 0) consulta = consulta.eq('camion_id', camion)
  const tipo = TIPOS_TRABAJO.find((t) => t === sp.get('tipo'))
  if (tipo) consulta = consulta.eq('tipo', tipo)
  const q = limpiarBusqueda(sp.get('q') ?? '')
  if (q) consulta = consulta.or(`descripcion.ilike.%${q}%,taller.ilike.%${q}%,notas.ilike.%${q}%`)

  const { data, error } = await consulta
  if (error) {
    if (faltaMigracionTCG(error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: 'No se pudieron cargar los trabajos' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const parsed = esquemaTrabajo.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { metodo_pago, con_factura, iva, comprobantes, ...trabajo } = parsed.data

  const { data: camion } = await auth.supabase.from('tcg_camiones').select('id').eq('id', trabajo.camion_id).single()
  if (!camion) return NextResponse.json({ error: 'El camión no existe' }, { status: 400 })

  try {
    const gasto_id = await sincronizarGastoTrabajo(auth.supabase, { ...trabajo, gasto_id: null }, { metodo_pago, con_factura, iva, comprobantes })
    const { data, error } = await auth.supabase.from('tcg_trabajos').insert({ ...trabajo, gasto_id }).select(SELECT_TRABAJO).single()
    if (error) {
      if (gasto_id) await auth.supabase.from('tcg_gastos').delete().eq('id', gasto_id)
      throw error
    }
    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar el trabajo' }, { status: 500 })
  }
}

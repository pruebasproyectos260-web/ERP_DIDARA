import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson, limpiarBusqueda } from '@/lib/campos'
import { esquemaMes, rangoMes } from '@/lib/finanzas'
import { AMBITOS, esquemaGastoTCG, faltaMigracionTCG } from '@/lib/transportes'
import { SELECT_GASTO_TCG, soloSuperAdmin } from '@/lib/transportes-servidor'

export async function GET(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const sp = req.nextUrl.searchParams

  let consulta = auth.supabase.from('tcg_gastos').select(SELECT_GASTO_TCG)
    .order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1000)

  const ambito = AMBITOS.find((a) => a === sp.get('ambito'))
  if (ambito) consulta = consulta.eq('ambito', ambito)
  const mes = esquemaMes.safeParse(sp.get('mes'))
  if (mes.success) {
    const { desde, hasta } = rangoMes(mes.data)
    consulta = consulta.gte('fecha', desde).lte('fecha', hasta)
  }
  const q = limpiarBusqueda(sp.get('q') ?? '')
  if (q) consulta = consulta.or(`descripcion.ilike.%${q}%,proveedor.ilike.%${q}%,categoria.ilike.%${q}%`)

  const { data, error } = await consulta
  if (error) {
    if (faltaMigracionTCG(error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: 'No se pudieron cargar los gastos' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const parsed = esquemaGastoTCG.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const datos = parsed.data
  // Solo los gastos de la empresa pueden ser de un camión
  if (datos.ambito === 'hogar') datos.camion_id = null

  const { data, error } = await auth.supabase.from('tcg_gastos').insert(datos).select(SELECT_GASTO_TCG).single()
  if (error) {
    if (faltaMigracionTCG(error)) return NextResponse.json({ error: 'Falta activar Transportes en Supabase (supabase/migracion_transportes.sql)' }, { status: 503 })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

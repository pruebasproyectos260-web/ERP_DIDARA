import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { errorValidacion, leerJson } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'
import { esquemaMes, esquemaRecurrente, faltaMigracionFinanzas, formatoMoneda, hoyMexico } from '@/lib/finanzas'
import { fijosDelMes, soloFinanzas } from '@/lib/finanzas-servidor'

/** Pagos y cobros fijos, con lo que ya se marcó en el mes */
export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado

  const mes = esquemaMes.safeParse(req.nextUrl.searchParams.get('mes'))
  const { data, error } = await fijosDelMes(auth.supabase, mes.success ? mes.data : hoyMexico().slice(0, 7))
  if (error) {
    if (faltaMigracionFinanzas(error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: 'No se pudieron cargar los pagos fijos' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado

  const parsed = esquemaRecurrente.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)

  const { data, error } = await auth.supabase.from('fin_recurrentes').insert(parsed.data).select('*').single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  await registrarActividad(auth, 'crear', 'fin_recurrentes', data.id,
    `${parsed.data.tipo === 'gasto' ? 'Pago' : 'Cobro'} fijo: ${parsed.data.nombre} ${formatoMoneda(parsed.data.monto)}/mes`)
  return NextResponse.json({ data }, { status: 201 })
}

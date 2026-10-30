import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { esquemaMes, hoyMexico, recurrenteVigente, vencimiento } from '@/lib/finanzas'
import { AMBITOS, esquemaFijo, faltaMigracionTCG } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

/** Gastos fijos de un ámbito, con si aplican en el mes, cuándo vencen y si ya se pagaron */
export async function GET(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const sp = req.nextUrl.searchParams
  const ambito = AMBITOS.find((a) => a === sp.get('ambito'))
  if (!ambito) return NextResponse.json({ error: 'Falta el ámbito' }, { status: 400 })
  const mesP = esquemaMes.safeParse(sp.get('mes'))
  const mes = mesP.success ? mesP.data : hoyMexico().slice(0, 7)

  const [fijos, pagos] = await Promise.all([
    auth.supabase.from('tcg_fijos').select('*').eq('ambito', ambito).order('dia', { nullsFirst: false }).order('nombre'),
    auth.supabase.from('tcg_gastos').select('id, fijo_id, monto, fecha, metodo_pago').eq('mes_fijo', mes).not('fijo_id', 'is', null),
  ])
  if (fijos.error) {
    if (faltaMigracionTCG(fijos.error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: 'No se pudieron cargar los gastos fijos' }, { status: 500 })
  }
  const data = fijos.data.map((f) => {
    const p = (pagos.data ?? []).find((x) => x.fijo_id === f.id)
    return {
      ...f,
      vigente: recurrenteVigente(f, mes),
      vence: vencimiento(mes, f.dia),
      pagado: p ? { id: p.id, monto: Number(p.monto), fecha: p.fecha, metodo_pago: p.metodo_pago } : null,
    }
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const parsed = esquemaFijo.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const datos = parsed.data
  if (datos.ambito === 'hogar') datos.camion_id = null
  const { data, error } = await auth.supabase.from('tcg_fijos').insert(datos).select('*').single()
  if (error) {
    if (faltaMigracionTCG(error)) return NextResponse.json({ error: 'Falta activar los gastos fijos en Supabase (supabase/migracion_transportes_fijos.sql)' }, { status: 503 })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

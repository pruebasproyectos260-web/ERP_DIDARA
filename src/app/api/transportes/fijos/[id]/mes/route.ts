import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { esquemaMes, hoyMexico, ivaIncluido, rangoMes, recurrenteVigente } from '@/lib/finanzas'
import { esquemaPagarFijo } from '@/lib/transportes'
import { SELECT_GASTO_TCG, soloSuperAdmin } from '@/lib/transportes-servidor'

/** Marca un gasto fijo como pagado en un mes: crea su gasto (uno por mes) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await leerJson(req)
  const parsed = esquemaPagarFijo.safeParse(body)
  if (!parsed.success) return errorValidacion(parsed.error)
  const { mes, monto, fecha, metodo_pago } = parsed.data
  // zod deja en null el método aunque no se haya mandado: solo cuenta si vino en la petición
  const metodoEnviado = 'metodo_pago' in body

  const { data: f } = await auth.supabase.from('tcg_fijos').select('*').eq('id', id).single()
  if (!f) return NextResponse.json({ error: 'Gasto fijo no encontrado' }, { status: 404 })
  if (!recurrenteVigente(f, mes)) return NextResponse.json({ error: 'Este gasto fijo no aplica en ese mes' }, { status: 400 })

  // Sin fecha: hoy (mes en curso o adelantado); un mes pasado, su último día
  const hoy = hoyMexico()
  const total = monto ?? Number(f.monto)
  const { data, error } = await auth.supabase.from('tcg_gastos').insert({
    ambito: f.ambito,
    fecha: fecha ?? (mes >= hoy.slice(0, 7) ? hoy : rangoMes(mes).hasta),
    categoria: f.categoria,
    descripcion: f.nombre,
    monto: total,
    metodo_pago: metodoEnviado ? metodo_pago ?? null : f.metodo_pago,
    con_factura: f.con_factura,
    iva: f.con_factura ? ivaIncluido(total) : null,
    camion_id: f.camion_id,
    fijo_id: f.id,
    mes_fijo: mes,
  }).select(SELECT_GASTO_TCG).single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya está marcado como pagado este mes' }, { status: 409 })
    return NextResponse.json({ error: 'No se pudo registrar el pago' }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

/** Desmarca: borra el gasto de ese mes (con sus fotos) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const mes = esquemaMes.safeParse(req.nextUrl.searchParams.get('mes'))
  if (!mes.success) return NextResponse.json({ error: 'Mes inválido' }, { status: 400 })

  const { data } = await auth.supabase.from('tcg_gastos').delete().eq('fijo_id', id).eq('mes_fijo', mes.data).select('comprobantes')
  const fotos = (data ?? []).flatMap((g) => g.comprobantes ?? [])
  if (fotos.length) await auth.supabase.storage.from('documentos').remove(fotos)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'

export async function GET(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase, nivel } = auth
  const { searchParams } = new URL(req.url)
  const mes  = parseInt(searchParams.get('mes')  ?? String(new Date().getMonth() + 1))
  const anio = parseInt(searchParams.get('anio') ?? String(new Date().getFullYear()))

  const mesKey = `${anio}-${String(mes).padStart(2, '0')}`
  const desde  = `${mesKey}-01`
  const hasta  = `${mesKey}-31`

  // El nivel 2 solo ve conteos de cotizaciones y reportes, sin montos ni gastos
  if (nivel > NIVEL.ADMIN) {
    const [{ data: cotizaciones }, { data: reportes }] = await Promise.all([
      supabase.from('cotizaciones').select('id, fecha, estado').gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`),
      supabase.from('reportes').select('id, fecha_ingreso').gte('fecha_ingreso', `${anio}-01-01`).lte('fecha_ingreso', `${anio}-12-31`),
    ])
    return NextResponse.json({
      data: {
        cotizaciones: (cotizaciones ?? []).map((c) => ({ ...c, total: 0 })),
        reportes: (reportes ?? []).map((r) => ({ ...r, total: 0 })),
        movimientos: [],
        mesKey, mes, anio, desde, hasta,
      }
    })
  }

  // Dinero: lo que realmente entró y salió (Finanzas → movimientos)
  const [
    { data: cotizaciones },
    { data: reportes },
    { data: movimientos },
  ] = await Promise.all([
    supabase.from('cotizaciones').select('id, folio, fecha, estado, total, ganancia_total, ganancia_real, pct_didara, cliente:clientes(id,nombre)').gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`),
    supabase.from('reportes').select('id, folio, fecha_ingreso, total, cliente:clientes(id,nombre), tipo_servicio').gte('fecha_ingreso', `${anio}-01-01`).lte('fecha_ingreso', `${anio}-12-31`),
    supabase.from('movimientos').select('tipo, fecha, monto').gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`),
  ])

  return NextResponse.json({
    data: {
      cotizaciones: cotizaciones ?? [],
      reportes: reportes ?? [],
      movimientos: (movimientos ?? []).map((m) => ({ ...m, monto: Number(m.monto) })),
      mesKey,
      mes,
      anio,
      desde,
      hasta,
    }
  })
}

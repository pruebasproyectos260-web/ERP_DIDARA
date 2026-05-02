import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const mes  = parseInt(searchParams.get('mes')  ?? String(new Date().getMonth() + 1))
  const anio = parseInt(searchParams.get('anio') ?? String(new Date().getFullYear()))

  const mesKey = `${anio}-${String(mes).padStart(2, '0')}`
  const desde  = `${mesKey}-01`
  const hasta  = `${mesKey}-31`

  const [
    { data: cotizaciones },
    { data: reportes },
    { data: ingresosManuales },
    { data: gananciasFijas },
    { data: gastosFijos },
    { data: gastosVariables },
  ] = await Promise.all([
    supabase.from('cotizaciones').select('id, folio, fecha, estado, total, ganancia_total, ganancia_real, pct_didara, cliente:clientes(id,nombre)').gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`),
    supabase.from('reportes').select('id, folio, fecha_ingreso, total, cliente:clientes(id,nombre), tipo_servicio').gte('fecha_ingreso', `${anio}-01-01`).lte('fecha_ingreso', `${anio}-12-31`),
    supabase.from('ingresos_manuales').select('*').gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`),
    supabase.from('ganancias_fijas').select('*'),
    supabase.from('gastos_fijos').select('*'),
    supabase.from('gastos_variables').select('*').gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`),
  ])

  return NextResponse.json({
    data: {
      cotizaciones: cotizaciones ?? [],
      reportes: reportes ?? [],
      ingresosManuales: ingresosManuales ?? [],
      gananciasFijas: gananciasFijas ?? [],
      gastosFijos: gastosFijos ?? [],
      gastosVariables: gastosVariables ?? [],
      mesKey,
      mes,
      anio,
      desde,
      hasta,
    }
  })
}

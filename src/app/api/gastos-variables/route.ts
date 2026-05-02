import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')   // '1'-'12'
  const anio = searchParams.get('anio') // '2026'

  let query = supabase.from('gastos_variables').select('*').order('fecha', { ascending: false })

  if (mes && anio) {
    const m = mes.padStart(2, '0')
    const desde = `${anio}-${m}-01`
    const hasta = `${anio}-${m}-31`
    query = query.gte('fecha', desde).lte('fecha', hasta)
  } else if (anio) {
    query = query.gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('gastos_variables')
    .insert(body)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gastos_fijos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { fecha_inicio, ...rest } = body

  const { data, error } = await supabase
    .from('gastos_fijos')
    .insert({ ...rest, fecha_inicio: fecha_inicio || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (fecha_inicio) {
    await backfillRegistros(supabase, data.id, fecha_inicio, data.monto)
  }

  return NextResponse.json({ data }, { status: 201 })
}

async function backfillRegistros(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  gastoFijoId: number,
  fechaInicio: string,
  monto: number
) {
  const [startY, startM] = fechaInicio.split('-').map(Number)
  const now = new Date()
  const registros: { gasto_fijo_id: number; mes_key: string; monto: number }[] = []
  let y = startY, m = startM
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
    registros.push({ gasto_fijo_id: gastoFijoId, mes_key: `${y}-${String(m).padStart(2, '0')}`, monto })
    m++; if (m > 12) { m = 1; y++ }
  }
  if (registros.length > 0) {
    await supabase.from('gastos_fijos_registros').upsert(registros, { onConflict: 'gasto_fijo_id,mes_key', ignoreDuplicates: true })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('ganancias_fijas')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json()
  const { fecha_inicio, ...rest } = body

  const { data, error } = await supabase
    .from('ganancias_fijas')
    .insert({ ...rest, fecha_inicio: fecha_inicio || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Backfill registros mensuales desde fecha_inicio hasta mes actual
  if (fecha_inicio) {
    await backfillRegistros(supabase, 'ganancias_fijas_registros', 'ganancia_fija_id', data.id, fecha_inicio, data.monto)
  }

  return NextResponse.json({ data }, { status: 201 })
}

async function backfillRegistros(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createServiceClient>,
  tabla: string,
  fkCol: string,
  fkId: number,
  fechaInicio: string,
  monto: number
) {
  const [startY, startM] = fechaInicio.split('-').map(Number)
  const now = new Date()
  const endY = now.getFullYear()
  const endM = now.getMonth() + 1

  const registros: { mes_key: string; monto: number; [k: string]: unknown }[] = []
  let y = startY, m = startM
  while (y < endY || (y === endY && m <= endM)) {
    const mesKey = `${y}-${String(m).padStart(2, '0')}`
    registros.push({ [fkCol]: fkId, mes_key: mesKey, monto })
    m++
    if (m > 12) { m = 1; y++ }
  }

  if (registros.length > 0) {
    await supabase.from(tabla).upsert(registros, { onConflict: `${fkCol},mes_key`, ignoreDuplicates: true })
  }
}

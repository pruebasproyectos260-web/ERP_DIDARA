import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, pick } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function GET() {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth

  const { data, error } = await supabase
    .from('gastos_fijos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { fecha_inicio, ...rest } = pick(await leerJson(req), CAMPOS.gastos_fijos)

  const { data, error } = await supabase
    .from('gastos_fijos')
    .insert({ ...rest, fecha_inicio: fecha_inicio || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'crear', 'gastos_fijos', data.id, `${data.nombre}: $${data.monto}/mes`)

  if (typeof fecha_inicio === 'string' && fecha_inicio) {
    await backfillRegistros(supabase, data.id, fecha_inicio, data.monto)
  }

  return NextResponse.json({ data }, { status: 201 })
}

async function backfillRegistros(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createServiceClient>,
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

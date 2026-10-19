import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, pick } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function GET() {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth

  const { data, error } = await supabase
    .from('ganancias_fijas')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { fecha_inicio, ...rest } = pick(await leerJson(req), CAMPOS.ganancias_fijas)

  const { data, error } = await supabase
    .from('ganancias_fijas')
    .insert({ ...rest, fecha_inicio: fecha_inicio || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'crear', 'ganancias_fijas', data.id, `${data.descripcion}: $${data.monto}/mes`)

  // Backfill registros mensuales desde fecha_inicio hasta mes actual
  if (typeof fecha_inicio === 'string' && fecha_inicio) {
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

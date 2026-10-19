import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { leerJson, pick } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params
  const body = pick(await leerJson(req), ['ganancia_real', 'pct_didara'])

  const { data, error } = await supabase
    .from('cotizaciones')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'editar', 'cotizaciones', id,
    `${data.folio}: ganancia real ${body.ganancia_real ?? '—'}, % Didara ${body.pct_didara ?? '—'}`)
  return NextResponse.json({ data })
}

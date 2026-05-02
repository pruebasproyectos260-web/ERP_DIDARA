import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('ganancias_fijas')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si cambia monto o fecha_inicio, rebackfill
  if (body.fecha_inicio || body.monto !== undefined) {
    const { data: gf } = await supabase.from('ganancias_fijas').select('fecha_inicio, monto').eq('id', id).single()
    if (gf?.fecha_inicio) {
      await supabase.from('ganancias_fijas_registros').delete().eq('ganancia_fija_id', id)
      const [startY, startM] = gf.fecha_inicio.split('-').map(Number)
      const now = new Date()
      const registros: { ganancia_fija_id: number; mes_key: string; monto: number }[] = []
      let y = startY, m = startM
      while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
        registros.push({ ganancia_fija_id: Number(id), mes_key: `${y}-${String(m).padStart(2, '0')}`, monto: gf.monto })
        m++; if (m > 12) { m = 1; y++ }
      }
      if (registros.length > 0) await supabase.from('ganancias_fijas_registros').insert(registros)
    }
  }

  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('ganancias_fijas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

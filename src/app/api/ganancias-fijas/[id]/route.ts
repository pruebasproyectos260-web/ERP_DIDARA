import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, pick } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params
  const body = pick(await leerJson(req), CAMPOS.ganancias_fijas)

  const { data, error } = await supabase
    .from('ganancias_fijas')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'editar', 'ganancias_fijas', id, `${data.descripcion}: $${data.monto}/mes`)

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
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

  const { data: borrados, error } = await supabase.from('ganancias_fijas').delete().eq('id', id).select('descripcion, monto')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (borrados?.length) await registrarActividad(auth, 'eliminar', 'ganancias_fijas', id, `${borrados[0].descripcion}: $${borrados[0].monto}/mes`)
  return NextResponse.json({ ok: true })
}

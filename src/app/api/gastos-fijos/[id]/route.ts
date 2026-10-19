import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, pick } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params
  const body = pick(await leerJson(req), CAMPOS.gastos_fijos)

  const { data, error } = await supabase
    .from('gastos_fijos')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'editar', 'gastos_fijos', id, `${data.nombre}: $${data.monto}/mes`)

  if (body.fecha_inicio || body.monto !== undefined) {
    const { data: gf } = await supabase.from('gastos_fijos').select('fecha_inicio, monto').eq('id', id).single()
    if (gf?.fecha_inicio) {
      await supabase.from('gastos_fijos_registros').delete().eq('gasto_fijo_id', id)
      const [startY, startM] = gf.fecha_inicio.split('-').map(Number)
      const now = new Date()
      const registros: { gasto_fijo_id: number; mes_key: string; monto: number }[] = []
      let y = startY, m = startM
      while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
        registros.push({ gasto_fijo_id: Number(id), mes_key: `${y}-${String(m).padStart(2, '0')}`, monto: gf.monto })
        m++; if (m > 12) { m = 1; y++ }
      }
      if (registros.length > 0) await supabase.from('gastos_fijos_registros').insert(registros)
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

  const { data: borrados, error } = await supabase.from('gastos_fijos').delete().eq('id', id).select('nombre, monto')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (borrados?.length) await registrarActividad(auth, 'eliminar', 'gastos_fijos', id, `${borrados[0].nombre}: $${borrados[0].monto}/mes`)
  return NextResponse.json({ ok: true })
}

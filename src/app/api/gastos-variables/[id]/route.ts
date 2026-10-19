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
  const body = pick(await leerJson(req), CAMPOS.gastos_variables)

  const { data, error } = await supabase
    .from('gastos_variables')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'editar', 'gastos_variables', id, `${data.tipo} $${data.monto} (${data.fecha})`)
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

  const { data: borrados, error } = await supabase.from('gastos_variables').delete().eq('id', id).select('tipo, monto, fecha')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (borrados?.length) await registrarActividad(auth, 'eliminar', 'gastos_variables', id, `${borrados[0].tipo} $${borrados[0].monto} (${borrados[0].fecha})`)
  return NextResponse.json({ ok: true })
}

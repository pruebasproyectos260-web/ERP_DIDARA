import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, ocultarCostosProducto, pick } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase, nivel } = auth
  const { id } = await params

  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data: nivel >= NIVEL.RESTRINGIDO ? ocultarCostosProducto(data) : data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params
  const body = pick(await leerJson(req), CAMPOS.productos)

  const { data, error } = await supabase
    .from('productos')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'editar', 'productos', id, `${data.codigo ?? ''} ${data.nombre} (stock: ${data.stock})`.trim())
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

  const { data: borrados, error } = await supabase
    .from('productos')
    .update({ activo: false })
    .eq('id', id)
    .select('codigo, nombre')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (borrados?.length) await registrarActividad(auth, 'eliminar', 'productos', id, `${borrados[0].codigo ?? ''} ${borrados[0].nombre}`.trim())
  return NextResponse.json({ ok: true })
}

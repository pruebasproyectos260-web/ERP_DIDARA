import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { CAMPOS, leerJson, pick } from '@/lib/campos'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params
  const body = pick(await leerJson(req), CAMPOS.pendientes)

  const { data, error } = await supabase
    .from('pendientes')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

  const { error } = await supabase.from('pendientes').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

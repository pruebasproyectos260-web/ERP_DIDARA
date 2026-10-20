import { NextRequest, NextResponse } from 'next/server'
import { requireNivel, type Sesion } from '@/lib/auth'
import { CAMPOS, leerJson, pick } from '@/lib/campos'
import { puedeVerEvento } from '@/lib/agenda'

/** Solo se modifica un evento que uno puede ver (encargado, quien lo creó, o niveles 0 y 1) */
async function eventoPermitido(auth: Sesion, id: string) {
  const { data: ev } = await auth.supabase.from('eventos').select('responsables, responsable_id').eq('id', id).single()
  if (!ev || !puedeVerEvento(ev, auth)) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
  return null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params
  const rechazo = await eventoPermitido(auth, id)
  if (rechazo) return rechazo
  const body = pick(await leerJson(req), CAMPOS.eventos)

  const { data, error } = await supabase
    .from('eventos')
    .update(body)
    .eq('id', id)
    .select('*, cliente:clientes(id, nombre)')
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
  const rechazo = await eventoPermitido(auth, id)
  if (rechazo) return rechazo

  const { error } = await supabase.from('eventos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

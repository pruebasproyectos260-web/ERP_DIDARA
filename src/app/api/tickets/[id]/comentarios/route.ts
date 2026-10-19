import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { errorValidacion, leerJson } from '@/lib/campos'
import { esquemaComentario } from '@/lib/tickets'

// Comentario del equipo en el seguimiento de un ticket (visible al cliente o nota interna)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

  const parsed = esquemaComentario.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)

  const { data: ticket } = await supabase.from('tickets').select('id').eq('id', id).single()
  if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('ticket_comentarios')
    .insert({ ticket_id: ticket.id, autor_id: auth.userId, autor_nombre: auth.nombre, ...parsed.data })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticket.id)
  return NextResponse.json({ data }, { status: 201 })
}

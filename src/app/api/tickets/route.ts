import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { errorValidacion, leerJson } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'
import { ETIQUETA_ORIGEN, esquemaTicketInterno, faltaMigracion } from '@/lib/tickets'
import { avisarAsignacion, avisarTicketRegistrado, comentarioSistema, crearTicket, nombreCliente, type TicketFila } from '@/lib/tickets-servidor'

export async function GET() {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth

  const { data, error } = await auth.supabase
    .from('tickets')
    .select('*, cliente:clientes(id, nombre)')
    .order('created_at', { ascending: false })

  if (error) {
    if (faltaMigracion(error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth

  const parsed = esquemaTicketInterno.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const datos = parsed.data

  if (datos.cliente_id) {
    const { data: cliente } = await supabase.from('clientes').select('id').eq('id', datos.cliente_id).single()
    if (!cliente) return NextResponse.json({ error: 'El cliente no existe' }, { status: 400 })
  }

  const { data: ticket, error } = await crearTicket(supabase, {
    ...datos,
    cliente_nombre: datos.cliente_id ? null : datos.cliente_nombre,
    creado_por: auth.userId,
  })
  if (error || !ticket) {
    if (faltaMigracion(error)) return NextResponse.json({ error: 'Falta crear las tablas de la mesa de ayuda (supabase/migracion_tickets.sql)' }, { status: 500 })
    return NextResponse.json({ error: error?.message ?? 'No se pudo crear el ticket' }, { status: 500 })
  }

  await comentarioSistema(supabase, ticket.id, `Ticket registrado por ${auth.nombre} (${ETIQUETA_ORIGEN[datos.origen].toLowerCase()})`)
  await registrarActividad(auth, 'crear', 'tickets', ticket.id, `${ticket.folio} ${ticket.asunto}`)

  const { data: completo } = await supabase.from('tickets').select('*, cliente:clientes(id, nombre)').eq('id', ticket.id).single()
  if (completo) {
    // Asignado: solo a esa persona. Sin asignar: a todo el equipo
    await avisarAsignacion(supabase, req, completo as TicketFila, nombreCliente(completo), auth)
    await avisarTicketRegistrado(supabase, completo as TicketFila, nombreCliente(completo), auth.userId)
  }
  return NextResponse.json({ data: completo }, { status: 201 })
}

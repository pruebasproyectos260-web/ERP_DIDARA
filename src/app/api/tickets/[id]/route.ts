import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { errorValidacion, leerJson } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'
import { ESTADOS_CERRADOS, ETIQUETA_ESTADO, ETIQUETA_PRIORIDAD, esquemaCambioTicket } from '@/lib/tickets'
import { avisarAsignacion, avisarResuelto, comentarioSistema, nombreCliente, type TicketFila } from '@/lib/tickets-servidor'

const SELECT = '*, cliente:clientes(id, nombre)'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const [{ data: ticket, error }, { data: comentarios }] = await Promise.all([
    auth.supabase.from('tickets').select(SELECT).eq('id', id).single(),
    auth.supabase.from('ticket_comentarios').select('*').eq('ticket_id', id).order('created_at'),
  ])
  if (error || !ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

  let reporte = null
  if (ticket.reporte_id) {
    const { data } = await auth.supabase.from('reportes').select('id, folio, estado').eq('id', ticket.reporte_id).single()
    reporte = data
  }
  return NextResponse.json({ data: { ...ticket, comentarios: comentarios ?? [], reporte } })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

  const body = await leerJson(req)
  const parsed = esquemaCambioTicket.safeParse(body)
  if (!parsed.success) return errorValidacion(parsed.error)
  // Solo los campos que vinieron en la petición: zod convierte los de contacto ausentes en null
  // y sin este filtro un simple cambio de estado borraría el nombre/correo/teléfono del cliente.
  const cambios = Object.fromEntries(
    Object.entries(parsed.data).filter(([campo]) => campo in body)
  ) as typeof parsed.data

  const { data: previo } = await supabase.from('tickets').select(SELECT).eq('id', id).single()
  if (!previo) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

  const update: Record<string, unknown> = { ...cambios, updated_at: new Date().toISOString() }
  const cambioEstado = cambios.estado !== undefined && cambios.estado !== previo.estado
  if (cambioEstado) update.resuelto_at = ESTADOS_CERRADOS.includes(cambios.estado!) ? new Date().toISOString() : null

  const { data: ticket, error } = await supabase.from('tickets').update(update).eq('id', id).select(SELECT).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Historial visible en el seguimiento del ticket
  if (cambioEstado) {
    await comentarioSistema(supabase, Number(id), `Estado: ${ETIQUETA_ESTADO[previo.estado as keyof typeof ETIQUETA_ESTADO]} → ${ETIQUETA_ESTADO[cambios.estado!]}`, auth.nombre)
  }
  if (cambios.prioridad !== undefined && cambios.prioridad !== previo.prioridad) {
    await comentarioSistema(supabase, Number(id), `Prioridad: ${ETIQUETA_PRIORIDAD[cambios.prioridad]}`, auth.nombre)
  }
  if (cambios.asignado_a !== undefined && cambios.asignado_a !== previo.asignado_a) {
    let nombre = 'nadie'
    if (cambios.asignado_a) {
      const { data: u } = await supabase.from('usuarios').select('nombre').eq('id', cambios.asignado_a).single()
      nombre = u?.nombre ?? 'otro usuario'
    }
    await comentarioSistema(supabase, Number(id), `Asignado a ${nombre}`, auth.nombre)
  }
  if (cambios.reporte_id && cambios.reporte_id !== previo.reporte_id) {
    const { data: rep } = await supabase.from('reportes').select('folio').eq('id', cambios.reporte_id).single()
    if (rep) await comentarioSistema(supabase, Number(id), `Se registró el reporte de servicio ${rep.folio}`, auth.nombre)
  }

  if (cambioEstado && cambios.estado === 'resuelto') {
    await avisarResuelto(req, ticket as TicketFila, nombreCliente(ticket))
  }
  if (cambios.asignado_a && cambios.asignado_a !== previo.asignado_a) {
    await avisarAsignacion(supabase, req, ticket as TicketFila, nombreCliente(ticket), auth)
  }

  await registrarActividad(auth, cambioEstado ? 'cambiar_estado' : 'editar', 'tickets', id,
    cambioEstado ? `${previo.folio}: ${previo.estado} → ${cambios.estado}` : previo.folio)

  return NextResponse.json({ data: ticket })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { data: borrados, error } = await auth.supabase.from('tickets').delete().eq('id', id).select('folio, asunto')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (borrados?.length) await registrarActividad(auth, 'eliminar', 'tickets', id, `${borrados[0].folio} ${borrados[0].asunto}`)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { leerJson } from '@/lib/campos'
import { ESTADOS_CERRADOS, type EstadoTicket } from '@/lib/tickets'
import { tokenPortalValido } from '@/lib/portal'
import { avisarRespuestaCliente, comentarioSistema, type TicketFila } from '@/lib/tickets-servidor'

// Respuesta del cliente a uno de sus tickets desde el portal público.
// Si el ticket ya estaba resuelto/cerrado, se reabre para que el equipo lo vea.

const MAX_MENSAJES_DIA = 30

export async function POST(req: NextRequest) {
  const { c, t, folio, mensaje } = await leerJson(req)
  const clienteId = Number(c)
  if (!Number.isInteger(clienteId) || clienteId <= 0 || !tokenPortalValido(clienteId, t)) {
    return NextResponse.json({ error: 'Este enlace de soporte no es válido.' }, { status: 403 })
  }
  const texto = typeof mensaje === 'string' ? mensaje.trim() : ''
  if (texto.length < 2 || texto.length > 3000) {
    return NextResponse.json({ error: 'Escribe un mensaje (máximo 3000 caracteres).' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: ticket } = await supabase
    .from('tickets').select('*, cliente:clientes(nombre)')
    .eq('cliente_id', clienteId).eq('folio', String(folio ?? '')).single()
  if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase.from('ticket_comentarios').select('id', { count: 'exact', head: true })
    .eq('ticket_id', ticket.id).is('autor_id', null).eq('es_sistema', false).gte('created_at', hace24h)
  if ((count ?? 0) >= MAX_MENSAJES_DIA) {
    return NextResponse.json({ error: 'Alcanzaste el límite de mensajes por hoy en este ticket.' }, { status: 429 })
  }

  const cliente = ticket.cliente as { nombre?: string } | { nombre?: string }[] | null
  const nombreDelCliente = (Array.isArray(cliente) ? cliente[0]?.nombre : cliente?.nombre) ?? 'Cliente'
  const autor = ticket.contacto_nombre ?? nombreDelCliente
  const { error } = await supabase.from('ticket_comentarios').insert({
    ticket_id: ticket.id, autor_id: null, autor_nombre: autor, mensaje: texto, visible_cliente: true,
  })
  if (error) return NextResponse.json({ error: 'No se pudo enviar tu mensaje' }, { status: 500 })

  const reabierto = ESTADOS_CERRADOS.includes(ticket.estado as EstadoTicket)
  if (reabierto) {
    await supabase.from('tickets').update({ estado: 'abierto', resuelto_at: null, updated_at: new Date().toISOString() }).eq('id', ticket.id)
    await comentarioSistema(supabase, ticket.id, 'El cliente respondió: ticket reabierto')
  } else {
    await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticket.id)
  }
  await avisarRespuestaCliente(supabase, req, ticket as TicketFila, nombreDelCliente, autor, texto, reabierto)

  return NextResponse.json({ ok: true }, { status: 201 })
}

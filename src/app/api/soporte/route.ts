import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'
import { esquemaTicketPortal, faltaMigracion } from '@/lib/tickets'
import { tokenPortalValido } from '@/lib/portal'
import { avisarTicketNuevo, comentarioSistema, confirmarAlCliente, crearTicket } from '@/lib/tickets-servidor'

// Portal de soporte PÚBLICO (sin sesión). Cada cliente entra con su enlace /soporte?c=<id>&t=<token>.
// Solo expone los tickets de ESE cliente y los comentarios marcados como visibles para él.

const MAX_TICKETS_DIA = 10

const enlaceInvalido = () =>
  NextResponse.json({ error: 'Este enlace de soporte no es válido. Pide uno nuevo a Didara TI.' }, { status: 403 })

async function clienteDelEnlace(c: unknown, t: unknown) {
  const id = Number(c)
  if (!Number.isInteger(id) || id <= 0 || !tokenPortalValido(id, t)) return null
  const supabase = createServiceClient()
  const { data } = await supabase.from('clientes').select('id, nombre, activo').eq('id', id).single()
  return data?.activo ? { supabase, cliente: data } : null
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const acceso = await clienteDelEnlace(sp.get('c'), sp.get('t'))
  if (!acceso) return enlaceInvalido()
  const { supabase, cliente } = acceso

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, folio, asunto, descripcion, categoria, prioridad, estado, contacto_nombre, created_at, updated_at, resuelto_at')
    .eq('cliente_id', cliente.id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    if (faltaMigracion(error)) return NextResponse.json({ error: 'El portal de soporte aún no está disponible.' }, { status: 503 })
    return NextResponse.json({ error: 'No se pudieron cargar tus tickets' }, { status: 500 })
  }

  const ids = (tickets ?? []).map((t) => t.id)
  const { data: comentarios } = ids.length
    ? await supabase.from('ticket_comentarios')
        .select('ticket_id, autor_nombre, mensaje, es_sistema, created_at')
        .in('ticket_id', ids).eq('visible_cliente', true).order('created_at')
    : { data: [] }

  return NextResponse.json({
    data: {
      cliente: cliente.nombre,
      tickets: (tickets ?? []).map(({ id, ...t }) => ({
        ...t,
        comentarios: (comentarios ?? []).filter((c) => c.ticket_id === id)
          .map((c) => ({ autor_nombre: c.autor_nombre, mensaje: c.mensaje, es_sistema: c.es_sistema, created_at: c.created_at })),
      })),
    },
  })
}

export async function POST(req: NextRequest) {
  const body = await leerJson(req)
  const acceso = await clienteDelEnlace(body.c, body.t)
  if (!acceso) return enlaceInvalido()
  const { supabase, cliente } = acceso

  const parsed = esquemaTicketPortal.safeParse(body)
  if (!parsed.success) return errorValidacion(parsed.error)

  // Límite contra abusos del enlace público
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase.from('tickets').select('id', { count: 'exact', head: true })
    .eq('cliente_id', cliente.id).eq('origen', 'portal').gte('created_at', hace24h)
  if ((count ?? 0) >= MAX_TICKETS_DIA) {
    return NextResponse.json({ error: 'Alcanzaste el límite de tickets por hoy. Si es urgente, llámanos o escríbenos por WhatsApp.' }, { status: 429 })
  }

  const { data: ticket, error } = await crearTicket(supabase, { ...parsed.data, cliente_id: cliente.id, origen: 'portal' })
  if (error || !ticket) return NextResponse.json({ error: 'No se pudo registrar tu ticket. Intenta de nuevo.' }, { status: 500 })

  await comentarioSistema(supabase, ticket.id, 'Ticket levantado desde el portal de soporte', ticket.contacto_nombre ?? cliente.nombre)
  await registrarActividad({ userId: null, nombre: `${parsed.data.contacto_nombre} (${cliente.nombre}, portal)` }, 'crear', 'tickets', ticket.id, `${ticket.folio} ${ticket.asunto}`)
  await Promise.all([
    avisarTicketNuevo(supabase, req, ticket, cliente.nombre),
    confirmarAlCliente(req, ticket, cliente.nombre),
  ])

  return NextResponse.json({ data: { folio: ticket.folio } }, { status: 201 })
}

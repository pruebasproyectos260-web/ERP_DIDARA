import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { faltaMigracion } from '@/lib/tickets'

// Lo que pasó en la mesa de ayuda desde la última revisión: alimenta los avisos en vivo
// del ERP (aviso en pantalla + contador del menú). Se consulta cada 30 s con la pestaña visible.

const MARGEN_MS = 5000          // tolera diferencias de reloj entre el servidor y la base de datos
const MAX_ATRAS_MS = 60 * 60000 // nunca más de 1 h hacia atrás

export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase, userId } = auth

  const ahora = Date.now()
  const pedido = Date.parse(req.nextUrl.searchParams.get('desde') ?? '')
  const desde = new Date(Math.max(Number.isNaN(pedido) ? ahora : pedido, ahora - MAX_ATRAS_MS) - MARGEN_MS).toISOString()

  const [activos, nuevos, respuestas] = await Promise.all([
    supabase.from('tickets').select('id', { count: 'exact', head: true }).not('estado', 'in', '("resuelto","cerrado")'),
    // Tickets nuevos que no registró uno mismo
    supabase.from('tickets').select('id, folio, asunto, prioridad, cliente_nombre, cliente:clientes(nombre)')
      .gt('created_at', desde).or(`creado_por.is.null,creado_por.neq.${userId}`)
      .order('created_at').limit(10),
    // Mensajes de clientes desde el portal
    supabase.from('ticket_comentarios').select('id, ticket_id, autor_nombre, mensaje, ticket:tickets(folio)')
      .gt('created_at', desde).is('autor_id', null).eq('es_sistema', false)
      .order('created_at').limit(10),
  ])
  if (activos.error) {
    if (faltaMigracion(activos.error)) return NextResponse.json({ data: { ahora: new Date(ahora).toISOString(), activos: 0, eventos: [] } })
    return NextResponse.json({ error: 'No se pudieron revisar los tickets' }, { status: 500 })
  }

  // Las relaciones embebidas pueden venir como objeto o como arreglo de uno
  const unir = (v: unknown) => (Array.isArray(v) ? v[0] : v) as Record<string, string> | null | undefined
  const eventos = [
    ...(nuevos.data ?? []).map((t) => ({
      clave: `t${t.id}`, tipo: 'nuevo' as const, ticketId: t.id, folio: t.folio, urgente: t.prioridad === 'urgente',
      texto: `${t.asunto} · ${unir(t.cliente)?.nombre ?? t.cliente_nombre ?? 'Cliente'}`,
    })),
    ...(respuestas.data ?? []).map((c) => ({
      clave: `c${c.id}`, tipo: 'respuesta' as const, ticketId: c.ticket_id, folio: unir(c.ticket)?.folio ?? '', urgente: false,
      texto: `${c.autor_nombre}: ${c.mensaje.length > 90 ? `${c.mensaje.slice(0, 90)}…` : c.mensaje}`,
    })),
  ]

  return NextResponse.json({ data: { ahora: new Date(ahora).toISOString(), activos: activos.count ?? 0, eventos } })
}

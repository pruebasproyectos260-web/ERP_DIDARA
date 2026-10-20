import type { Sesion } from '@/lib/auth'
import { enviarCorreo } from '@/lib/correo'
import { escaparHtml, escaparMultilinea } from '@/lib/html'
import { CORREO_DIRECCION, botonCorreo, plantillaCorreo } from '@/lib/plantilla-correo'
import { origenPublico } from '@/lib/tokens'
import { ETIQUETA_CATEGORIA, ETIQUETA_ESTADO, ETIQUETA_PRIORIDAD, type EstadoTicket, type PrioridadTicket } from '@/lib/tickets'
import { urlPortal } from '@/lib/portal'
import { enviarPush } from '@/lib/push'

type Supabase = Sesion['supabase']

export interface TicketFila {
  id: number
  folio: string
  cliente_id: number | null
  cliente_nombre: string | null
  contacto_nombre: string | null
  contacto_email: string | null
  contacto_telefono: string | null
  asunto: string
  descripcion: string
  categoria: string
  prioridad: PrioridadTicket
  estado: EstadoTicket
  origen: string
  asignado_a: string | null
  reporte_id: number | null
  created_at: string
}

/** Inserta un ticket con folio TKT-XXXX; reintenta si otro ticket tomó el mismo folio */
export async function crearTicket(supabase: Supabase, datos: Record<string, unknown>) {
  for (let intento = 0; intento < 3; intento++) {
    const { data: folio, error: errFolio } = await supabase.rpc('generar_folio', { prefijo: 'TKT', tabla: 'tickets' })
    if (errFolio) return { data: null, error: errFolio }
    const { data, error } = await supabase.from('tickets').insert({ ...datos, folio }).select('*').single()
    if (!error) return { data: data as TicketFila, error: null }
    if (error.code !== '23505') return { data: null, error } // 23505 = folio repetido
  }
  return { data: null, error: { message: 'No se pudo asignar folio al ticket, intenta de nuevo', code: 'folio' } }
}

export async function comentarioSistema(supabase: Supabase, ticketId: number, mensaje: string, autor = 'Sistema') {
  await supabase.from('ticket_comentarios').insert({ ticket_id: ticketId, autor_nombre: autor, mensaje, es_sistema: true, visible_cliente: true })
}

/** Nombre del cliente (registrado o escrito a mano) */
export function nombreCliente(t: { cliente_nombre: string | null; cliente?: { nombre?: string } | null }) {
  return t.cliente?.nombre ?? t.cliente_nombre ?? 'Cliente'
}

// ── Avisos al equipo (correo + push) ─────────────────────────────────────
// Regla: un ticket SIN asignar es de todos (push a todo el equipo); en cuanto se asigna,
// sus avisos le llegan SOLO a la persona asignada. Los correos de ticket nuevo van a dirección.

/** Todo el equipo activo (push de tickets sin asignar), opcionalmente sin quien hizo la acción */
async function todoElEquipo(supabase: Supabase, excepto?: string | null) {
  const { data } = await supabase.from('usuarios').select('id').eq('activo', true)
  return (data ?? []).map((u) => u.id as string).filter((id) => id !== excepto)
}

/** Dirección y administradores (niveles 0 y 1): reciben el correo de los tickets nuevos del portal */
async function equipoDireccion(supabase: Supabase) {
  const { data } = await supabase.from('usuarios').select('id, correo').eq('activo', true).lte('nivel', 1)
  return {
    ids: (data ?? []).map((u) => u.id as string),
    correos: [...new Set([CORREO_DIRECCION, ...(data ?? []).map((u) => u.correo as string | null).filter((c): c is string => !!c?.includes('@'))])],
  }
}

async function usuarioActivo(supabase: Supabase, id: string) {
  const { data } = await supabase.from('usuarios').select('id, nombre, correo, activo').eq('id', id).single()
  return data?.activo ? data as { id: string; nombre: string; correo: string | null } : null
}

const urlEquipo = (req: Request, t: TicketFila) => `${origenPublico(req)}/tickets?ver=${t.id}`

function datosTicketHtml(t: TicketFila) {
  return `
      <table cellpadding="6" style="border-collapse:collapse;font-size:.9rem;color:#374151;">
        <tr><td style="color:#64748b;">Asunto</td><td><strong>${escaparHtml(t.asunto)}</strong></td></tr>
        <tr><td style="color:#64748b;">Prioridad</td><td>${escaparHtml(ETIQUETA_PRIORIDAD[t.prioridad])}</td></tr>
        <tr><td style="color:#64748b;">Categoría</td><td>${escaparHtml(ETIQUETA_CATEGORIA[t.categoria as keyof typeof ETIQUETA_CATEGORIA] ?? t.categoria)}</td></tr>
        <tr><td style="color:#64748b;">Contacto</td><td>${escaparHtml(t.contacto_nombre ?? '—')}${t.contacto_telefono ? ` · ${escaparHtml(t.contacto_telefono)}` : ''}${t.contacto_email ? ` · ${escaparHtml(t.contacto_email)}` : ''}</td></tr>
      </table>`
}

/** Aviso al equipo de un ticket nuevo levantado desde el portal */
export async function avisarTicketNuevo(supabase: Supabase, req: Request, t: TicketFila, cliente: string) {
  try {
    const [{ correos }, ids] = await Promise.all([equipoDireccion(supabase), todoElEquipo(supabase)])
    const urgente = t.prioridad === 'urgente'
    const contenido = `
      <p style="margin:0 0 14px;color:#374151;"><strong>${escaparHtml(cliente)}</strong> levantó un ticket desde el portal de soporte${urgente ? ' marcado como <strong style="color:#dc2626;">URGENTE</strong>' : ''}.</p>
      ${datosTicketHtml(t)}
      <p style="margin:16px 0 0;padding:12px 14px;background:#f8fafc;border-radius:8px;color:#374151;font-size:.9rem;">${escaparMultilinea(t.descripcion)}</p>
      ${botonCorreo('Ver en la mesa de ayuda', urlEquipo(req, t))}`
    await Promise.all([
      enviarCorreo({
        para: correos,
        asunto: `${urgente ? '🔴 URGENTE · ' : ''}Nuevo ticket ${t.folio} — ${cliente}`,
        html: plantillaCorreo(`Nuevo ticket ${escaparHtml(t.folio)}`, escaparHtml(cliente), contenido),
      }).catch(() => {}),
      enviarPush(supabase, ids, {
        titulo: `${urgente ? '🔴 ' : ''}Nuevo ticket ${t.folio} · ${cliente}`,
        cuerpo: t.asunto,
        url: `/tickets?ver=${t.id}`,
        etiqueta: `ticket-${t.id}`,
        urgente,
      }),
    ])
  } catch {
    // El aviso no debe impedir que el ticket se registre
  }
}

/** Ticket registrado por el equipo (WhatsApp, teléfono…) sin asignar: push a todos menos a quien lo registró */
export async function avisarTicketRegistrado(supabase: Supabase, t: TicketFila, cliente: string, registradoPor: string) {
  if (t.asignado_a) return // asignado: solo se avisa a esa persona (avisarAsignacion)
  try {
    const urgente = t.prioridad === 'urgente'
    await enviarPush(supabase, await todoElEquipo(supabase, registradoPor), {
      titulo: `${urgente ? '🔴 ' : ''}Nuevo ticket ${t.folio} · ${cliente}`,
      cuerpo: `${t.asunto} (sin asignar)`,
      url: `/tickets?ver=${t.id}`,
      etiqueta: `ticket-${t.id}`,
      urgente,
    })
  } catch { /* silencioso */ }
}

/** Aviso al técnico cuando le asignan un ticket (si no se lo asignó él mismo) */
export async function avisarAsignacion(supabase: Supabase, req: Request, t: TicketFila, cliente: string, asignadoPor: { userId: string; nombre: string }) {
  if (!t.asignado_a || t.asignado_a === asignadoPor.userId) return
  try {
    const tecnico = await usuarioActivo(supabase, t.asignado_a)
    if (!tecnico) return
    const urgente = t.prioridad === 'urgente'
    const contenido = `
      <p style="margin:0 0 14px;color:#374151;">Hola ${escaparHtml(tecnico.nombre.split(' ')[0])}, <strong>${escaparHtml(asignadoPor.nombre)}</strong> te asignó el ticket <strong>${escaparHtml(t.folio)}</strong> de <strong>${escaparHtml(cliente)}</strong>.</p>
      ${datosTicketHtml(t)}
      <p style="margin:16px 0 0;padding:12px 14px;background:#f8fafc;border-radius:8px;color:#374151;font-size:.9rem;">${escaparMultilinea(t.descripcion)}</p>
      ${botonCorreo('Ver el ticket', urlEquipo(req, t))}`
    await Promise.all([
      tecnico.correo?.includes('@') && enviarCorreo({
        para: tecnico.correo,
        asunto: `${urgente ? '🔴 URGENTE · ' : ''}Te asignaron el ticket ${t.folio} — ${cliente}`,
        html: plantillaCorreo(`Ticket ${escaparHtml(t.folio)} asignado`, escaparHtml(cliente), contenido),
      }).catch(() => {}),
      enviarPush(supabase, [tecnico.id], {
        titulo: `${urgente ? '🔴 ' : ''}Te asignaron ${t.folio} · ${cliente}`,
        cuerpo: t.asunto,
        url: `/tickets?ver=${t.id}`,
        etiqueta: `ticket-${t.id}`,
        urgente,
      }),
    ])
  } catch { /* silencioso */ }
}

/**
 * Aviso cuando el cliente responde desde el portal.
 * Asignado: solo al técnico (correo + push). Sin asignar: push a todo el equipo y correo a dirección.
 */
export async function avisarRespuestaCliente(supabase: Supabase, req: Request, t: TicketFila, cliente: string, autor: string, mensaje: string, reabierto: boolean) {
  try {
    const tecnico = t.asignado_a ? await usuarioActivo(supabase, t.asignado_a) : null
    const destino = tecnico
      ? { ids: [tecnico.id], correos: tecnico.correo?.includes('@') ? [tecnico.correo] : [] }
      : { ids: await todoElEquipo(supabase), correos: (await equipoDireccion(supabase)).correos }
    const contenido = `
      <p style="margin:0 0 14px;color:#374151;"><strong>${escaparHtml(autor)}</strong> (${escaparHtml(cliente)}) respondió en el ticket <strong>${escaparHtml(t.folio)}</strong> — “${escaparHtml(t.asunto)}”${reabierto ? '. El ticket estaba resuelto y <strong>se reabrió</strong>' : ''}.</p>
      <p style="margin:0;padding:12px 14px;background:#f8fafc;border-left:3px solid #187d78;border-radius:8px;color:#374151;font-size:.9rem;">${escaparMultilinea(mensaje)}</p>
      ${botonCorreo('Responder en la mesa de ayuda', urlEquipo(req, t))}`
    await Promise.all([
      destino.correos.length > 0 && enviarCorreo({
        para: destino.correos,
        asunto: `${reabierto ? 'Ticket reabierto' : 'Respuesta del cliente'} en ${t.folio} — ${cliente}`,
        html: plantillaCorreo(`Respuesta en ${escaparHtml(t.folio)}`, escaparHtml(cliente), contenido),
      }).catch(() => {}),
      enviarPush(supabase, destino.ids, {
        titulo: `💬 ${autor} respondió en ${t.folio}`,
        cuerpo: mensaje.length > 140 ? `${mensaje.slice(0, 140)}…` : mensaje,
        url: `/tickets?ver=${t.id}`,
        etiqueta: `ticket-${t.id}`,
      }),
    ])
  } catch { /* silencioso */ }
}

/** Confirmación al cliente (si dejó correo) con el enlace para seguir su ticket */
export async function confirmarAlCliente(req: Request, t: TicketFila, cliente: string) {
  if (!t.contacto_email || !t.cliente_id) return
  try {
    const contenido = `
      <p style="margin:0 0 14px;color:#374151;">Hola ${escaparHtml(t.contacto_nombre ?? '')}, recibimos tu solicitud de soporte. Te contactaremos a la brevedad.</p>
      <table cellpadding="6" style="border-collapse:collapse;font-size:.9rem;color:#374151;">
        <tr><td style="color:#64748b;">Folio</td><td><strong>${escaparHtml(t.folio)}</strong></td></tr>
        <tr><td style="color:#64748b;">Asunto</td><td>${escaparHtml(t.asunto)}</td></tr>
        <tr><td style="color:#64748b;">Prioridad</td><td>${escaparHtml(ETIQUETA_PRIORIDAD[t.prioridad])}</td></tr>
      </table>
      ${botonCorreo('Ver el estado de mi ticket', urlPortal(req, t.cliente_id))}`
    await enviarCorreo({
      para: t.contacto_email,
      asunto: `Recibimos tu ticket ${t.folio} — Didara TI`,
      html: plantillaCorreo(`Ticket ${escaparHtml(t.folio)} recibido`, escaparHtml(cliente), contenido),
    })
  } catch { /* silencioso */ }
}

/** Aviso al cliente cuando su ticket cambia a resuelto */
export async function avisarResuelto(req: Request, t: TicketFila, cliente: string, nota?: string) {
  if (!t.contacto_email || !t.cliente_id) return
  try {
    const contenido = `
      <p style="margin:0 0 14px;color:#374151;">Hola ${escaparHtml(t.contacto_nombre ?? '')}, tu ticket <strong>${escaparHtml(t.folio)}</strong> — “${escaparHtml(t.asunto)}” — quedó como <strong>${ETIQUETA_ESTADO.resuelto.toLowerCase()}</strong>.</p>
      ${nota ? `<p style="margin:0 0 14px;padding:12px 14px;background:#f8fafc;border-radius:8px;color:#374151;font-size:.9rem;">${escaparMultilinea(nota)}</p>` : ''}
      <p style="margin:0;color:#374151;">Si el problema continúa, puedes responder desde el portal.</p>
      ${botonCorreo('Ver mi ticket', urlPortal(req, t.cliente_id))}`
    await enviarCorreo({
      para: t.contacto_email,
      asunto: `Ticket ${t.folio} resuelto — Didara TI`,
      html: plantillaCorreo(`Ticket ${escaparHtml(t.folio)} resuelto`, escaparHtml(cliente), contenido),
    })
  } catch { /* silencioso */ }
}

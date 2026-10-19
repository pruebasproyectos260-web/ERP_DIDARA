import { z } from 'zod'

// Mesa de ayuda: catálogos y validación (se usa también en el navegador: sin código de servidor).
// Tablas `tickets` y `ticket_comentarios`, ver supabase/migracion_tickets.sql.
// El enlace del portal de cada cliente está en lib/portal.ts (solo servidor).

export const ESTADOS_TICKET = ['abierto', 'en_proceso', 'en_espera', 'resuelto', 'cerrado'] as const
export const PRIORIDADES_TICKET = ['baja', 'media', 'alta', 'urgente'] as const
export const ORIGENES_TICKET = ['portal', 'whatsapp', 'telefono', 'correo', 'interno'] as const
export const CATEGORIAS_TICKET = ['soporte', 'equipo', 'red', 'cctv', 'software', 'correo', 'impresora', 'otro'] as const

export type EstadoTicket = typeof ESTADOS_TICKET[number]
export type PrioridadTicket = typeof PRIORIDADES_TICKET[number]

export const ETIQUETA_ESTADO: Record<EstadoTicket, string> = {
  abierto: 'Abierto', en_proceso: 'En proceso', en_espera: 'En espera', resuelto: 'Resuelto', cerrado: 'Cerrado',
}
export const ETIQUETA_PRIORIDAD: Record<PrioridadTicket, string> = {
  baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente',
}
export const ETIQUETA_ORIGEN: Record<typeof ORIGENES_TICKET[number], string> = {
  portal: 'Portal', whatsapp: 'WhatsApp', telefono: 'Teléfono', correo: 'Correo', interno: 'Interno',
}
export const ETIQUETA_CATEGORIA: Record<typeof CATEGORIAS_TICKET[number], string> = {
  soporte: 'Soporte general', equipo: 'Equipo de cómputo', red: 'Red / Internet', cctv: 'Cámaras (CCTV)',
  software: 'Software', correo: 'Correo electrónico', impresora: 'Impresora', otro: 'Otro',
}

/** Estados que cuentan como "ya atendido" */
export const ESTADOS_CERRADOS: EstadoTicket[] = ['resuelto', 'cerrado']

const texto = (max: number) => z.string().trim().max(max)
const opcional = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null)

/** Datos que captura el cliente en el portal */
export const esquemaTicketPortal = z.object({
  contacto_nombre: texto(120).min(2, 'Escribe tu nombre'),
  contacto_email: z.union([z.literal(''), z.email('El correo no es válido')]).nullish().transform((v) => v || null),
  contacto_telefono: opcional(40),
  categoria: z.enum(CATEGORIAS_TICKET).default('soporte'),
  prioridad: z.enum(['media', 'urgente']).default('media'),
  asunto: texto(150).min(4, 'Escribe un asunto breve (mínimo 4 caracteres)'),
  descripcion: texto(5000).min(10, 'Describe el problema (mínimo 10 caracteres)'),
})

/** Datos que captura el equipo al registrar un ticket */
export const esquemaTicketInterno = z.object({
  cliente_id: z.number().int().positive().nullish().transform((v) => v ?? null),
  cliente_nombre: opcional(200),
  contacto_nombre: opcional(120),
  contacto_email: z.union([z.literal(''), z.email('El correo no es válido')]).nullish().transform((v) => v || null),
  contacto_telefono: opcional(40),
  categoria: z.enum(CATEGORIAS_TICKET).default('soporte'),
  prioridad: z.enum(PRIORIDADES_TICKET).default('media'),
  origen: z.enum(ORIGENES_TICKET).default('whatsapp'),
  asunto: texto(150).min(4, 'Escribe un asunto breve (mínimo 4 caracteres)'),
  descripcion: texto(5000).min(3, 'Escribe una descripción'),
  asignado_a: z.uuid().nullish().transform((v) => v ?? null),
}).refine((d) => d.cliente_id || d.cliente_nombre, { message: 'Elige un cliente o escribe su nombre', path: ['cliente_id'] })

/** Cambios que el equipo puede hacer a un ticket existente */
export const esquemaCambioTicket = z.object({
  estado: z.enum(ESTADOS_TICKET).optional(),
  prioridad: z.enum(PRIORIDADES_TICKET).optional(),
  categoria: z.enum(CATEGORIAS_TICKET).optional(),
  asignado_a: z.uuid().nullable().optional(),
  reporte_id: z.number().int().positive().nullable().optional(),
  asunto: texto(150).min(4).optional(),
  descripcion: texto(5000).min(3).optional(),
  contacto_nombre: opcional(120).optional(),
  contacto_email: z.union([z.literal(''), z.email('El correo no es válido')]).nullish().transform((v) => v || null).optional(),
  contacto_telefono: opcional(40).optional(),
})

export const esquemaComentario = z.object({
  mensaje: texto(3000).min(1, 'Escribe un mensaje'),
  visible_cliente: z.boolean().default(true),
})

/** Error de tabla inexistente (falta correr la migración) */
export function faltaMigracion(error: { code?: string } | null | undefined) {
  return error?.code === 'PGRST205' || error?.code === '42P01'
}

import { z } from 'zod'
import { NIVEL } from '@/lib/nivel'

// Finanzas: constantes y validaciones compartidas por el servidor y el navegador.
// Un "movimiento" es dinero que realmente entró o salió (gasto o ingreso).

export const TIPOS_MOVIMIENTO = ['gasto', 'ingreso'] as const
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]

export const METODOS_PAGO = ['Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Transferencia'] as const

/** Orden = orden en que se muestran al capturar (las más usadas en campo primero) */
export const CATEGORIAS_GASTO = [
  'Combustible', 'Casetas', 'Comida', 'Material', 'Herramienta', 'Transporte', 'Vehículo',
  'Papelería', 'Servicios', 'Software', 'Renta', 'Sueldos', 'Préstamos', 'Impuestos', 'Otro',
] as const
export const CATEGORIAS_INGRESO = ['Cotización', 'Servicio', 'Póliza', 'Otro ingreso'] as const

export interface Movimiento {
  id: number
  tipo: TipoMovimiento
  fecha: string
  categoria: string
  descripcion: string | null
  proveedor: string | null
  monto: number
  metodo_pago: string | null
  con_factura: boolean
  iva: number | null
  comprobantes: string[]
  cliente_id: number | null
  cotizacion_id: number | null
  reporte_id: number | null
  recurrente_id: number | null
  mes_recurrente: string | null
  registrado_por: string | null
  registrado_nombre: string | null
  revisado: boolean
  revisado_por: string | null
  importado: boolean
  created_at: string
  cliente?: { id: number; nombre: string } | null
  cotizacion?: { id: number; folio: string } | null
  reporte?: { id: number; folio: string } | null
}

/** Color de cada categoría (gráficas y burbujas). Las que no estén aquí usan gris. */
export const COLOR_CATEGORIA: Record<string, string> = {
  Combustible: '#f59e0b', Casetas: '#f97316', Comida: '#ef4444', Material: '#187d78',
  Herramienta: '#0ea5e9', Transporte: '#8b5cf6', Vehículo: '#6366f1', Papelería: '#ec4899',
  Servicios: '#14b8a6', Software: '#3b82f6', Renta: '#a855f7', Sueldos: '#10b981',
  Préstamos: '#64748b', Impuestos: '#dc2626', Otro: '#94a3b8',
  Cotización: '#16a34a', Servicio: '#0d9488', Póliza: '#7c3aed', 'Otro ingreso': '#65a30d',
}
export const colorCategoria = (c: string) => COLOR_CATEGORIA[c] ?? '#94a3b8'

/** Quién ve todas las finanzas: administración y la contadora. El resto solo registra y ve sus propios gastos. */
export const veFinanzas = (nivel: number, esContador: boolean) => nivel <= NIVEL.ADMIN || esContador

// ── Fechas por mes ('YYYY-MM') ─────────────────────────────────────────────

export const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const mesActual = () => hoyISO().slice(0, 7)

/** Hoy en México (el servidor de Render corre en UTC) */
export const hoyMexico = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())

export function sumarMeses(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function rangoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}`, dias: ultimo }
}

const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export function nombreMes(mes: string, corto = false) {
  const [a, m] = mes.split('-').map(Number)
  const n = NOMBRE_MES[m - 1] ?? ''
  return corto ? n.slice(0, 3) : `${n.charAt(0).toUpperCase()}${n.slice(1)} ${a}`
}

/** ¿El pago/cobro fijo aplica en ese mes? */
export const recurrenteVigente = (r: { desde: string; hasta: string | null }, mes: string) =>
  r.desde <= mes && (!r.hasta || r.hasta >= mes)

/** Fecha de vencimiento de un pago fijo en un mes (el día 31 se ajusta a meses cortos) */
export function vencimiento(mes: string, dia: number | null) {
  const { dias } = rangoMes(mes)
  return `${mes}-${String(Math.min(dia ?? dias, dias)).padStart(2, '0')}`
}

export const redondear = (n: number) => Math.round(n * 100) / 100

// ── IVA (regla acordada con Didara) ──────────────────────────────────────
// PAGOS (gastos): el monto que se captura es lo que se pagó, IVA incluido.
//   Con factura, el IVA se EXTRAE de ese monto para contabilidad.
// COBROS (ingresos): el precio se captura SIN IVA.
//   Con factura, el IVA se SUMA: el cliente paga precio + IVA y ese IVA va a contabilidad.
// En movimientos, "monto" siempre es el dinero que realmente entró o salió (IVA incluido)
// e "iva" es la parte de IVA; el subtotal es monto − iva.

export const TASA_IVA = 0.16
/** IVA contenido en un total que ya lo incluye (pagos) */
export const ivaIncluido = (total: number, tasa = TASA_IVA) => redondear(total - total / (1 + tasa))
/** IVA que se suma a un precio sin IVA (cobros) */
export const ivaSobre = (base: number, tasa = TASA_IVA) => redondear(base * tasa)

/** Lo que realmente entra o sale por un pago/cobro fijo: a los cobros con factura se les suma el IVA */
export const montoFijoReal = (f: { tipo: string; monto: unknown; con_factura: boolean }) =>
  f.tipo === 'ingreso' && f.con_factura ? redondear(Number(f.monto) + ivaSobre(Number(f.monto))) : Number(f.monto)

export const formatoMoneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

// ── Validaciones ────────────────────────────────────────────────────────────

const opcional = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null)
const dinero = z.number('Escribe el monto').positive('El monto debe ser mayor a 0').max(10_000_000, 'Monto demasiado grande').transform(redondear)
const fecha = z.iso.date('La fecha no es válida')
export const esquemaMes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido')
const metodo = z.enum(METODOS_PAGO).nullish().transform((v) => v ?? null)

/** Archivos de comprobante: comprobantes/<usuario>/<YYYY-MM>/<uuid>.<ext> en el bucket "documentos" */
export const RUTA_COMPROBANTE = /^comprobantes\/[0-9a-f-]{36}\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|heic|pdf)$/

const camposMovimiento = {
  tipo: z.enum(TIPOS_MOVIMIENTO).default('gasto'),
  fecha,
  categoria: z.string().trim().min(1, 'Elige una categoría').max(60),
  descripcion: opcional(300),
  proveedor: opcional(150),
  monto: dinero,
  metodo_pago: metodo,
  con_factura: z.boolean().default(false),
  iva: z.number().min(0).max(10_000_000).nullish().transform((v) => (v == null ? null : redondear(v))),
  comprobantes: z.array(z.string().regex(RUTA_COMPROBANTE, 'Comprobante inválido')).max(5, 'Máximo 5 comprobantes').default([]),
  cliente_id: z.number().int().positive().nullish().transform((v) => v ?? null),
}

export const esquemaMovimiento = z.object(camposMovimiento)
  .refine((d) => d.iva == null || d.iva <= d.monto, { message: 'El IVA no puede ser mayor que el total', path: ['iva'] })

/** Edición: todo opcional (usar con soloEnviados para no pisar lo que no vino) */
export const esquemaCambioMovimiento = z.object({ ...camposMovimiento, revisado: z.boolean() }).partial()

const baseRecurrente = z.object({
  tipo: z.enum(TIPOS_MOVIMIENTO),
  nombre: z.string().trim().min(2, 'Escribe un nombre').max(120),
  categoria: z.string().trim().min(1, 'Elige una categoría').max(60),
  monto: z.number('Escribe el monto').min(0).max(10_000_000).transform(redondear),
  dia: z.number().int().min(1).max(31).nullish().transform((v) => v ?? null),
  desde: esquemaMes,
  hasta: esquemaMes.nullish().transform((v) => v ?? null),
  cliente_id: z.number().int().positive().nullish().transform((v) => v ?? null),
  metodo_pago: metodo,
  con_factura: z.boolean().default(false),
  notas: opcional(300),
})

export const esquemaRecurrente = baseRecurrente
  .refine((d) => !d.hasta || d.hasta >= d.desde, { message: 'El último mes no puede ser antes del primero', path: ['hasta'] })

/** Edición: todo opcional (usar con soloEnviados para no pisar lo que no vino) */
export const esquemaCambioRecurrente = baseRecurrente.partial()

/** Marcar un pago/cobro fijo como hecho en un mes */
export const esquemaMarcarMes = z.object({
  mes: esquemaMes,
  monto: dinero.optional(),
  fecha: fecha.optional(),
  metodo_pago: metodo.optional(),
})

/** Pago recibido de una cotización o reporte (cobranza) */
export const esquemaPago = z.object({
  origen: z.enum(['cotizacion', 'reporte']),
  id: z.number().int().positive(),
  /** Importe que se abona, SIN IVA (con factura el servidor le suma el IVA) */
  monto: dinero.optional(),
  fecha: fecha.optional(),
  metodo_pago: metodo,
  con_factura: z.boolean().optional(),
  /** Se cobró antes de usar Finanzas: se registra con la fecha del documento, sin afectar el mes actual */
  ya_cobrado: z.boolean().default(false),
})

export function faltaMigracionFinanzas(error: { code?: string } | null | undefined) {
  return error?.code === 'PGRST205' || error?.code === '42P01'
}

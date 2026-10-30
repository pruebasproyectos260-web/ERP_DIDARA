import { z } from 'zod'
import { esquemaMes, METODOS_PAGO, redondear } from '@/lib/finanzas'

// Transportes de Carga General Vicente Guerrero (TCG): módulo privado del super admin (nivel 0).
// Constantes, validaciones y cálculo de asistencia/aguinaldo, compartidos por servidor y navegador.

export const NOMBRE_TCG = 'Transportes de Carga General Vicente Guerrero'

// ── Gastos ─────────────────────────────────────────────────────────────────

export const AMBITOS = ['empresa', 'hogar'] as const
export type Ambito = (typeof AMBITOS)[number]

/** Orden = orden en que se muestran al capturar (las más usadas primero) */
export const CATEGORIAS_TCG: Record<Ambito, readonly string[]> = {
  empresa: [
    'Combustible', 'Casetas', 'Mantenimiento', 'Refacciones', 'Sueldos', 'Comida', 'Renta', 'Servicios',
    'Seguros', 'Impuestos', 'Papelería', 'Préstamos', 'Otro',
  ],
  hogar: [
    'Súper', 'Comida', 'Servicios', 'Casa', 'Escuela', 'Salud', 'Transporte', 'Ropa', 'Entretenimiento',
    'Préstamos', 'Otro',
  ],
}
/** Categoría con la que entra el gasto de un trabajo hecho a un camión */
export const CATEGORIA_TRABAJO = 'Mantenimiento'

export interface GastoTCG {
  id: number
  ambito: Ambito
  fecha: string
  categoria: string
  descripcion: string | null
  proveedor: string | null
  monto: number
  metodo_pago: string | null
  con_factura: boolean
  iva: number | null
  comprobantes: string[]
  camion_id: number | null
  /** Pago de un gasto fijo (y de qué mes) */
  fijo_id?: number | null
  mes_fijo?: string | null
  created_at: string
  camion?: { id: number; nombre: string } | null
  /** Si el gasto salió de un trabajo de Camiones (se edita desde ahí) */
  trabajo?: { id: number; tipo: TipoTrabajo }[] | { id: number; tipo: TipoTrabajo } | null
}

export const trabajoDeGasto = (g: Pick<GastoTCG, 'trabajo'>) => (Array.isArray(g.trabajo) ? g.trabajo[0] : g.trabajo) ?? null

/** Gasto que se paga cada mes (renta, luz, internet, colegiatura…) */
export interface FijoTCG {
  id: number
  ambito: Ambito
  nombre: string
  categoria: string
  monto: number
  dia: number | null
  desde: string
  hasta: string | null
  metodo_pago: string | null
  con_factura: boolean
  camion_id: number | null
  notas: string | null
  /** Calculado para el mes que se consulta */
  vigente: boolean
  vence: string
  pagado: { id: number; monto: number; fecha: string; metodo_pago: string | null } | null
}

/** Fotos de tickets de Transportes: tcg/<YYYY-MM>/<uuid>.<ext> en el bucket "documentos" */
export const RUTA_COMPROBANTE_TCG = /^tcg\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|heic|pdf)$/
export const urlComprobanteTCG = (ruta: string) => `/api/transportes/comprobantes?ruta=${encodeURIComponent(ruta)}`

// ── Camiones y trabajos ────────────────────────────────────────────────────

export const TIPOS_TRABAJO = ['mecanico', 'electrico', 'carroceria', 'neumaticos', 'otro'] as const
export type TipoTrabajo = (typeof TIPOS_TRABAJO)[number]
export const ETIQUETA_TRABAJO: Record<TipoTrabajo, string> = {
  mecanico: 'Mecánico', electrico: 'Eléctrico', carroceria: 'Carrocería', neumaticos: 'Neumáticos', otro: 'Otro',
}
export const COLOR_TRABAJO: Record<TipoTrabajo, string> = {
  mecanico: '#2563eb', electrico: '#d97706', carroceria: '#7c3aed', neumaticos: '#334155', otro: '#64748b',
}

export interface Camion {
  id: number
  nombre: string
  placas: string | null
  marca: string | null
  modelo: string | null
  anio: number | null
  notas: string | null
  activo: boolean
}

export interface Trabajo {
  id: number
  camion_id: number
  fecha: string
  tipo: TipoTrabajo
  descripcion: string
  taller: string | null
  kilometraje: number | null
  costo: number
  gasto_id: number | null
  notas: string | null
  gasto?: { id: number; metodo_pago: string | null; con_factura: boolean; iva: number | null; comprobantes: string[] } | null
}

// ── Asistencia y aguinaldo ─────────────────────────────────────────────────

/** Días de sueldo de aguinaldo (mínimo de ley, art. 87 LFT) */
export const DIAS_AGUINALDO = 15
export const FUENTES_ACTIVIDAD = ['talones', 'remisiones', 'relaciones', 'caja'] as const

export const ESTADOS_MANUALES = ['asistio', 'falta', 'permiso', 'vacaciones'] as const
export type EstadoManual = (typeof ESTADOS_MANUALES)[number]

/**
 * Cómo quedó cada día de un empleado:
 * - registro: hizo algo en TALONES/REMI (asistió)
 * - sin_registro: la oficina trabajó pero él no registró nada; cuenta como asistido salvo que se marque falta
 * - asistio / falta / permiso / vacaciones: marcado a mano (manda sobre lo automático)
 * - futuro: día hábil que aún no llega (para estimar el aguinaldo al cierre del año)
 * - cerrado: nadie registró nada en la oficina (probable feriado): no cuenta ni a favor ni en contra
 * - no_laborable: domingo o día festivo de ley
 * - fuera: antes de su ingreso o después de su baja
 */
export type EstadoDia = 'registro' | 'sin_registro' | EstadoManual | 'futuro' | 'cerrado' | 'no_laborable' | 'fuera'

export const ETIQUETA_ESTADO: Record<EstadoDia, string> = {
  registro: 'Asistió (TALONES/REMI)', sin_registro: 'Sin registros: cuenta como asistido', asistio: 'Asistió (marcado)',
  falta: 'Falta', permiso: 'Permiso sin goce', vacaciones: 'Vacaciones', futuro: 'Por venir',
  cerrado: 'No se trabajó', no_laborable: 'Domingo o festivo', fuera: 'No trabajaba aquí',
}

/** Con este movimiento o menos en toda la oficina, el día queda "por revisar" */
export const UMBRAL_POCO_MOVIMIENTO = 2

/** Movimiento de la oficina en un día (tabla tcg_dias). documentos null = aún no se lee; estado: lo que decidió el usuario. */
export interface DiaOficina { documentos: number | null; estado: 'laborable' | 'cerrado' | null }

/**
 * ¿Se trabajó ese día en la oficina?
 * - Domingo o festivo: no (salvo que se marque como laborable).
 * - Ya revisado por TALONES/REMI sin ningún movimiento de nadie: probablemente no (feriado).
 * - Muy poco movimiento: sí, pero "por revisar".
 * - Sin datos todavía (no se ha leído), o es hoy y el día no ha terminado: se asume que sí.
 */
export function estadoOficina(fecha: string, dia: DiaOficina | undefined, feriados: Set<string>, hoy?: string): 'laborable' | 'revisar' | 'cerrado' | 'no_laborable' {
  if (dia?.estado === 'laborable') return 'laborable'
  if (dia?.estado === 'cerrado') return 'cerrado'
  if (!esLaborable(fecha, feriados)) return 'no_laborable'
  if (dia?.documentos == null || (hoy && fecha >= hoy)) return 'laborable'
  if (dia.documentos === 0) return 'cerrado'
  return dia.documentos <= UMBRAL_POCO_MOVIMIENTO ? 'revisar' : 'laborable'
}

/** Estados que suman días para el aguinaldo (las vacaciones son días pagados) */
const CUENTA = new Set<EstadoDia>(['registro', 'sin_registro', 'asistio', 'vacaciones', 'futuro'])

const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

/** N-ésimo lunes del mes (mes 1-12) */
function lunes(anio: number, mes: number, n: number) {
  const primero = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay()
  const dia = 1 + ((8 - primero) % 7) + (n - 1) * 7
  return iso(new Date(Date.UTC(anio, mes - 1, dia)))
}

/** Días de descanso obligatorio (art. 74 LFT) */
export function festivos(anio: number): Set<string> {
  const f = new Set([`${anio}-01-01`, lunes(anio, 2, 1), lunes(anio, 3, 3), `${anio}-05-01`, `${anio}-09-16`, lunes(anio, 11, 3), `${anio}-12-25`])
  if ((anio - 2024) % 6 === 0) f.add(`${anio}-10-01`) // cambio de Poder Ejecutivo federal
  return f
}

/** Lunes a sábado, sin festivos */
export function esLaborable(fecha: string, feriados = festivos(Number(fecha.slice(0, 4)))) {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay() !== 0 && !feriados.has(fecha)
}

/** Todas las fechas de un año ('YYYY-MM-DD') */
export function diasDelAnio(anio: number) {
  const dias: string[] = []
  for (let d = new Date(Date.UTC(anio, 0, 1)); d.getUTCFullYear() === anio; d.setUTCDate(d.getUTCDate() + 1)) dias.push(iso(d))
  return dias
}

export interface EmpleadoTCG {
  id: number
  nombre: string
  usuario_sistema: string | null
  sueldo_semanal: number
  fecha_ingreso: string | null
  fecha_baja: string | null
  activo: boolean
  notas: string | null
}

export interface ResumenAnio {
  dias: Map<string, EstadoDia>
  /** Días trabajables del año completo (base del aguinaldo proporcional) */
  habilesAnio: number
  /** Hasta hoy: días hábiles en que ya trabajaba y cuántos cuentan */
  habilesHoy: number
  asistidosHoy: number
  conRegistro: number
  sinRegistro: number
  faltas: number
  permisos: number
  vacaciones: number
  /** Días que cuentan para el aguinaldo si asiste el resto del año */
  diasAguinaldo: number
  sueldoDiario: number
  aguinaldo: number
}

/**
 * Asistencia de un empleado en un año y su aguinaldo estimado:
 * sueldo diario (semanal ÷ 7) × 15 × días que cuentan ÷ días trabajables del año.
 * Los días en que la oficina no trabajó no cuentan ni a favor ni en contra.
 */
export function resumenAnio(
  e: Pick<EmpleadoTCG, 'usuario_sistema' | 'sueldo_semanal' | 'fecha_ingreso' | 'fecha_baja'>,
  anio: number,
  conActividad: Set<string>,
  manual: Map<string, EstadoManual>,
  oficina: Map<string, DiaOficina>,
  hoy: string,
): ResumenAnio {
  const feriados = festivos(anio)
  const dias = new Map<string, EstadoDia>()
  const r = { habilesAnio: 0, habilesHoy: 0, asistidosHoy: 0, conRegistro: 0, sinRegistro: 0, faltas: 0, permisos: 0, vacaciones: 0, diasAguinaldo: 0 }

  for (const fecha of diasDelAnio(anio)) {
    const deOficina = estadoOficina(fecha, oficina.get(fecha), feriados, hoy)
    if (deOficina === 'no_laborable') { dias.set(fecha, 'no_laborable'); continue }
    if (deOficina === 'cerrado') { dias.set(fecha, 'cerrado'); continue }
    r.habilesAnio++
    if ((e.fecha_ingreso && fecha < e.fecha_ingreso) || (e.fecha_baja && fecha > e.fecha_baja)) { dias.set(fecha, 'fuera'); continue }

    // Hoy, mientras no haya registros, todavía no se sabe (cuenta como por venir)
    const marca = manual.get(fecha)
    const estado: EstadoDia = marca
      ?? (e.usuario_sistema && conActividad.has(fecha) ? 'registro'
        : fecha >= hoy ? 'futuro' : 'sin_registro')
    dias.set(fecha, estado)

    if (CUENTA.has(estado)) r.diasAguinaldo++
    if (fecha <= hoy) {
      r.habilesHoy++
      if (CUENTA.has(estado)) r.asistidosHoy++
    }
    if (estado === 'registro') r.conRegistro++
    else if (estado === 'sin_registro') r.sinRegistro++
    else if (estado === 'falta') r.faltas++
    else if (estado === 'permiso') r.permisos++
    else if (estado === 'vacaciones') r.vacaciones++
  }

  const sueldoDiario = redondear(Number(e.sueldo_semanal) / 7)
  const aguinaldo = r.habilesAnio ? redondear((Number(e.sueldo_semanal) / 7) * DIAS_AGUINALDO * (r.diasAguinaldo / r.habilesAnio)) : 0
  return { dias, ...r, sueldoDiario, aguinaldo }
}

// ── Validaciones ────────────────────────────────────────────────────────────

const opcional = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null)
const fecha = z.iso.date('La fecha no es válida')
const metodo = z.enum(METODOS_PAGO).nullish().transform((v) => v ?? null)
const comprobantes = z.array(z.string().regex(RUTA_COMPROBANTE_TCG, 'Comprobante inválido')).max(5, 'Máximo 5 comprobantes').default([])
const iva = z.number().min(0).max(10_000_000).nullish().transform((v) => (v == null ? null : redondear(v)))
const idOpcional = z.number().int().positive().nullish().transform((v) => v ?? null)

const camposGasto = {
  ambito: z.enum(AMBITOS),
  fecha,
  categoria: z.string().trim().min(1, 'Elige una categoría').max(60),
  descripcion: opcional(300),
  proveedor: opcional(150),
  monto: z.number('Escribe el monto').positive('El monto debe ser mayor a 0').max(10_000_000, 'Monto demasiado grande').transform(redondear),
  metodo_pago: metodo,
  con_factura: z.boolean().default(false),
  iva,
  comprobantes,
  camion_id: idOpcional,
}
export const esquemaGastoTCG = z.object(camposGasto)
  .refine((d) => d.iva == null || d.iva <= d.monto, { message: 'El IVA no puede ser mayor que el total', path: ['iva'] })
/** Edición: todo opcional (usar con soloEnviados para no pisar lo que no vino) */
export const esquemaCambioGastoTCG = z.object(camposGasto).partial()

const camposFijo = {
  ambito: z.enum(AMBITOS),
  nombre: z.string().trim().min(2, 'Escribe qué se paga').max(120),
  categoria: z.string().trim().min(1, 'Elige una categoría').max(60),
  monto: z.number('Escribe el monto').positive('El monto debe ser mayor a 0').max(10_000_000).transform(redondear),
  dia: z.number().int().min(1).max(31).nullish().transform((v) => v ?? null),
  desde: esquemaMes,
  hasta: esquemaMes.nullish().transform((v) => v ?? null),
  metodo_pago: metodo,
  con_factura: z.boolean().default(false),
  camion_id: idOpcional,
  notas: opcional(300),
}
export const esquemaFijo = z.object(camposFijo)
  .refine((d) => !d.hasta || d.hasta >= d.desde, { message: 'El último mes no puede ser antes del primero', path: ['hasta'] })
export const esquemaCambioFijo = z.object(camposFijo).partial()

/** Marcar un fijo como pagado en un mes */
export const esquemaPagarFijo = z.object({
  mes: esquemaMes,
  monto: z.number().positive().max(10_000_000).transform(redondear).optional(),
  fecha: fecha.optional(),
  metodo_pago: metodo.optional(),
})

const camposCamion = {
  nombre: z.string().trim().min(1, 'Escribe el nombre o número del camión').max(60),
  placas: opcional(20),
  marca: opcional(60),
  modelo: opcional(60),
  anio: z.number().int().min(1950).max(2100).nullish().transform((v) => v ?? null),
  notas: opcional(500),
  activo: z.boolean().default(true),
}
export const esquemaCamion = z.object(camposCamion)
export const esquemaCambioCamion = z.object(camposCamion).partial()

const camposTrabajo = {
  camion_id: z.number('Elige el camión').int().positive('Elige el camión'),
  fecha,
  tipo: z.enum(TIPOS_TRABAJO, 'Elige el tipo de trabajo'),
  descripcion: z.string().trim().min(2, 'Describe el trabajo').max(500),
  taller: opcional(150),
  kilometraje: z.number().int().min(0).max(10_000_000).nullish().transform((v) => v ?? null),
  costo: z.number().min(0, 'El costo no puede ser negativo').max(10_000_000).default(0).transform(redondear),
  notas: opcional(500),
  // Del gasto que genera (si costó algo)
  metodo_pago: metodo,
  con_factura: z.boolean().default(false),
  iva,
  comprobantes,
}
export const esquemaTrabajo = z.object(camposTrabajo)
  .refine((d) => d.iva == null || d.iva <= d.costo, { message: 'El IVA no puede ser mayor que el costo', path: ['iva'] })
export const esquemaCambioTrabajo = z.object(camposTrabajo).partial()

const camposEmpleado = {
  nombre: z.string().trim().min(2, 'Escribe el nombre').max(80),
  usuario_sistema: z.string().trim().max(30).nullish().transform((v) => (v ? v.toUpperCase() : null)),
  sueldo_semanal: z.number('Escribe el sueldo semanal').min(0).max(1_000_000).transform(redondear),
  fecha_ingreso: fecha.nullish().transform((v) => v ?? null),
  fecha_baja: fecha.nullish().transform((v) => v ?? null),
  activo: z.boolean().default(true),
  notas: opcional(500),
}
export const esquemaEmpleado = z.object(camposEmpleado)
  .refine((d) => !d.fecha_ingreso || !d.fecha_baja || d.fecha_baja >= d.fecha_ingreso, { message: 'La baja no puede ser antes del ingreso', path: ['fecha_baja'] })
export const esquemaCambioEmpleado = z.object(camposEmpleado).partial()

export const esquemaMarcaAsistencia = z.object({
  empleado_id: z.number().int().positive(),
  fecha,
  /** null = quitar la marca y volver a lo automático */
  estado: z.enum(ESTADOS_MANUALES).nullable(),
  nota: opcional(200),
})

/** Decidir a mano si la oficina trabajó un día (null = volver a lo automático) */
export const esquemaMarcaDia = z.object({
  fecha,
  estado: z.enum(['laborable', 'cerrado']).nullable(),
  nota: opcional(200),
})

/**
 * Lo que manda la Raspberry cada noche:
 * - dias: TODAS las fechas revisadas con el total de documentos de la oficina (también las de 0)
 * - registros: quién hizo algo cada día
 */
export const esquemaImportarActividad = z.object({
  dias: z.array(z.object({
    fecha,
    documentos: z.number().int().min(0).max(100_000),
  })).max(1000),
  registros: z.array(z.object({
    fecha,
    usuario: z.string().trim().min(1).max(30).transform((v) => v.toUpperCase()),
    documentos: z.number().int().min(0).max(100_000),
    fuentes: z.array(z.enum(FUENTES_ACTIVIDAD)).max(FUENTES_ACTIVIDAD.length),
  })).max(5000),
})

export function faltaMigracionTCG(error: { code?: string } | null | undefined) {
  return error?.code === 'PGRST205' || error?.code === '42P01'
}

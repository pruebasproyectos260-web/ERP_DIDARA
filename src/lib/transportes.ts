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
    'Súper', 'Comida', 'Gastos papá', 'Servicios', 'Casa', 'Escuela', 'Salud', 'Transporte', 'Vehículo', 'Ropa', 'Entretenimiento',
    'Seguros', 'Préstamos', 'Otro',
  ],
}

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

/** Gasto que se repite: cada mes (renta, luz, colegiatura) o cada varios meses (seguros, tenencia…) */
export interface FijoTCG {
  id: number
  ambito: Ambito
  nombre: string
  categoria: string
  monto: number
  dia: number | null
  /** Mes del primer pago ('YYYY-MM') */
  desde: string
  hasta: string | null
  /** 1 = mensual, 3 = trimestral, 6 = semestral, 12 = anual… */
  cada_meses: number
  metodo_pago: string | null
  con_factura: boolean
  camion_id: number | null
  notas: string | null
  /** Calculado para el mes que se consulta */
  vigente: boolean
  vence: string
  /** Siguiente mes en que toca pagar (desde el mes consultado) */
  proximo: string | null
  pagado: { id: number; monto: number; fecha: string; metodo_pago: string | null } | null
}

export const PERIODOS = [
  { meses: 1, nombre: 'Cada mes' }, { meses: 2, nombre: 'Cada 2 meses' }, { meses: 3, nombre: 'Cada 3 meses (trimestral)' },
  { meses: 4, nombre: 'Cada 4 meses' }, { meses: 6, nombre: 'Cada 6 meses (semestral)' }, { meses: 12, nombre: 'Cada año' },
] as const
export const nombrePeriodo = (meses: number) =>
  meses === 1 ? 'mensual' : meses === 12 ? 'anual' : meses === 6 ? 'semestral' : meses === 3 ? 'trimestral' : `cada ${meses} meses`

/** Meses entre dos 'YYYY-MM' (b − a) */
export const mesesEntre = (a: string, b: string) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7))

/** ¿Toca pagar este fijo en ese mes? (dentro de su vigencia y en su ciclo de cada N meses) */
export function fijoAplica(f: { desde: string; hasta: string | null; cada_meses?: number | null }, mes: string) {
  const n = mesesEntre(f.desde, mes)
  return n >= 0 && (!f.hasta || mes <= f.hasta) && n % Math.max(1, f.cada_meses ?? 1) === 0
}

/** Primer mes desde `mes` (incluido) en que toca pagar; null si ya terminó */
export function proximoMesFijo(f: { desde: string; hasta: string | null; cada_meses?: number | null }, mes: string) {
  const cada = Math.max(1, f.cada_meses ?? 1)
  const n = Math.max(0, mesesEntre(f.desde, mes))
  const salto = Math.ceil(n / cada) * cada
  const [a, m] = f.desde.split('-').map(Number)
  const d = new Date(a, m - 1 + salto, 1)
  const proximo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return f.hasta && proximo > f.hasta ? null : proximo
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

/** Vehículos: camiones de la empresa o carros de la familia (misma tabla tcg_camiones) */
export const USOS = ['empresa', 'familia'] as const
export type Uso = (typeof USOS)[number]
/** A dónde van los gastos de un vehículo y con qué categoría */
export const AMBITO_DE_USO: Record<Uso, Ambito> = { empresa: 'empresa', familia: 'hogar' }
export const CATEGORIA_TRABAJO: Record<Uso, string> = { empresa: 'Mantenimiento', familia: 'Vehículo' }
export const NOMBRE_USO: Record<Uso, { uno: string; varios: string }> = {
  empresa: { uno: 'camión', varios: 'camiones' },
  familia: { uno: 'carro', varios: 'carros' },
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
  uso: Uso
  aceite_cada_km: number | null
  aceite_cada_meses: number | null
  aceite_ultimo_km: number | null
  aceite_ultima_fecha: string | null
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
  cambio_aceite: boolean
  gasto?: { id: number; metodo_pago: string | null; con_factura: boolean; iva: number | null; comprobantes: string[] } | null
}

// ── Documentos de vehículos ────────────────────────────────────────────────

export const TIPOS_DOCUMENTO = [
  'seguro', 'verificacion_fisico', 'verificacion_emisiones', 'verificacion', 'tarjeta_circulacion', 'tenencia',
  'permiso', 'factura', 'otro',
] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]
export const ETIQUETA_DOCUMENTO: Record<TipoDocumento, string> = {
  seguro: 'Seguro', verificacion_fisico: 'Verificación físico-mecánica', verificacion_emisiones: 'Verificación de emisiones',
  verificacion: 'Verificación', tarjeta_circulacion: 'Tarjeta de circulación', tenencia: 'Tenencia / refrendo',
  permiso: 'Permiso SCT', factura: 'Factura', otro: 'Otro',
}
/** Lo que se da de alta al agregar un vehículo (vacío, para llenar fecha y archivo) */
export const DOCUMENTOS_INICIALES: Record<Uso, { tipo: TipoDocumento; cada_meses: number | null }[]> = {
  empresa: [
    { tipo: 'seguro', cada_meses: 12 }, { tipo: 'verificacion_fisico', cada_meses: 6 },
    { tipo: 'verificacion_emisiones', cada_meses: 6 }, { tipo: 'tarjeta_circulacion', cada_meses: null },
  ],
  familia: [
    { tipo: 'seguro', cada_meses: 12 }, { tipo: 'verificacion', cada_meses: 6 },
    { tipo: 'tenencia', cada_meses: 12 }, { tipo: 'tarjeta_circulacion', cada_meses: null },
  ],
}

export interface DocumentoTCG {
  id: number
  camion_id: number
  tipo: TipoDocumento
  nombre: string
  vence: string | null
  cada_meses: number | null
  archivos: string[]
  notas: string | null
  updated_at: string
}

export type EstadoVencimiento = 'vencido' | 'este_mes' | 'pronto' | 'ok' | 'sin_fecha'
/** Vencido · toca este mes · en 30 días o menos · al corriente · sin fecha */
export function estadoVencimiento(vence: string | null, hoy: string): EstadoVencimiento {
  if (!vence) return 'sin_fecha'
  if (vence < hoy) return 'vencido'
  if (vence.slice(0, 7) === hoy.slice(0, 7)) return 'este_mes'
  return diasEntre(hoy, vence) <= 30 ? 'pronto' : 'ok'
}

export const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)

/** Suma meses a una fecha 'YYYY-MM-DD' (el 31 se ajusta a meses cortos) */
export function sumarMesesFecha(fecha: string, meses: number) {
  const [a, m, d] = fecha.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate()
  const r = new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimo)))
  return r.toISOString().slice(0, 10)
}

// ── Kilometraje y cambio de aceite ─────────────────────────────────────────

/** Al faltar esto o menos para el cambio de aceite, avisa */
export const AVISO_ACEITE_KM = 1000
export const AVISO_ACEITE_DIAS = 15

export interface EstadoAceite {
  estado: 'sin_datos' | 'ok' | 'pronto' | 'vencido'
  /** Último cambio (de un trabajo marcado como cambio de aceite o el que se capturó al dar de alta) */
  ultimoKm: number | null
  ultimaFecha: string | null
  proximoKm: number | null
  proximaFecha: string | null
  faltanKm: number | null
  faltanDias: number | null
}

/** Cambio de aceite por km o por meses, lo que pase primero */
export function estadoAceite(
  c: Pick<Camion, 'aceite_cada_km' | 'aceite_cada_meses' | 'aceite_ultimo_km' | 'aceite_ultima_fecha'>,
  kmActual: number | null,
  ultimoTrabajo: { km: number | null; fecha: string } | null,
  hoy: string,
): EstadoAceite {
  // El cambio más reciente: el del trabajo si es posterior al que se capturó a mano
  const usarTrabajo = ultimoTrabajo && (!c.aceite_ultima_fecha || ultimoTrabajo.fecha >= c.aceite_ultima_fecha)
  const ultimoKm = usarTrabajo ? ultimoTrabajo.km : c.aceite_ultimo_km
  const ultimaFecha = usarTrabajo ? ultimoTrabajo.fecha : c.aceite_ultima_fecha
  const proximoKm = c.aceite_cada_km && ultimoKm != null ? ultimoKm + c.aceite_cada_km : null
  const proximaFecha = c.aceite_cada_meses && ultimaFecha ? sumarMesesFecha(ultimaFecha, c.aceite_cada_meses) : null
  const faltanKm = proximoKm != null && kmActual != null ? proximoKm - kmActual : null
  const faltanDias = proximaFecha ? diasEntre(hoy, proximaFecha) : null
  if (faltanKm == null && faltanDias == null) return { estado: 'sin_datos', ultimoKm, ultimaFecha, proximoKm, proximaFecha, faltanKm, faltanDias }
  const estado = (faltanKm != null && faltanKm <= 0) || (faltanDias != null && faltanDias < 0) ? 'vencido'
    : (faltanKm != null && faltanKm <= AVISO_ACEITE_KM) || (faltanDias != null && faltanDias <= AVISO_ACEITE_DIAS) ? 'pronto' : 'ok'
  return { estado, ultimoKm, ultimaFecha, proximoKm, proximaFecha, faltanKm, faltanDias }
}

// ── Asistencia y aguinaldo ─────────────────────────────────────────────────

/** Días de sueldo de aguinaldo (mínimo de ley, art. 87 LFT) */
export const DIAS_AGUINALDO = 15
export const FUENTES_ACTIVIDAD = ['talones', 'remisiones', 'relaciones', 'caja'] as const

export const ESTADOS_MANUALES = ['asistio', 'falta', 'permiso', 'vacaciones', 'descanso'] as const
export type EstadoManual = (typeof ESTADOS_MANUALES)[number]

/**
 * Cómo quedó cada día de un empleado:
 * - registro: hizo algo en TALONES/REMI (asistió)
 * - sin_registro: la oficina trabajó pero él no registró nada; cuenta como asistido salvo que se marque falta
 * - falta_auto: igual, pero para quien captura a diario (sin_registro_es_falta): cuenta como falta
 * - asistio / falta / permiso / vacaciones: marcado a mano (manda sobre lo automático)
 * - futuro: día hábil que aún no llega (para estimar el aguinaldo al cierre del año)
 * - cerrado: nadie registró nada en la oficina (probable feriado): no cuenta ni a favor ni en contra
 * - no_laborable: domingo o día festivo de ley
 * - fuera: antes de su ingreso o después de su baja
 */
export type EstadoDia = 'registro' | 'sin_registro' | 'falta_auto' | EstadoManual | 'futuro' | 'cerrado' | 'no_laborable' | 'fuera'

export const ETIQUETA_ESTADO: Record<EstadoDia, string> = {
  registro: 'Asistió (capturó en TALONES/REMI)', sin_registro: 'Sin registros: cuenta como asistido',
  falta_auto: 'Falta: no capturó talones ni informes', asistio: 'Asistió (marcado)',
  falta: 'Falta', permiso: 'Permiso sin goce', vacaciones: 'Vacaciones', descanso: 'Día de descanso', futuro: 'Por venir',
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
const CUENTA = new Set<EstadoDia>(['registro', 'sin_registro', 'asistio', 'vacaciones', 'descanso', 'futuro'])

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
  /** Captura a diario: un día sin talones ni informes cuenta como falta (si no, como asistido) */
  sin_registro_es_falta: boolean
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
  descansos: number
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
  e: Pick<EmpleadoTCG, 'usuario_sistema' | 'sueldo_semanal' | 'fecha_ingreso' | 'fecha_baja'> & { sin_registro_es_falta?: boolean | null },
  anio: number,
  conActividad: Set<string>,
  manual: Map<string, EstadoManual>,
  oficina: Map<string, DiaOficina>,
  hoy: string,
): ResumenAnio {
  const feriados = festivos(anio)
  const dias = new Map<string, EstadoDia>()
  const r = { habilesAnio: 0, habilesHoy: 0, asistidosHoy: 0, conRegistro: 0, sinRegistro: 0, faltas: 0, permisos: 0, vacaciones: 0, descansos: 0, diasAguinaldo: 0 }

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
        : fecha >= hoy ? 'futuro'
          : e.usuario_sistema && e.sin_registro_es_falta ? 'falta_auto' : 'sin_registro')
    dias.set(fecha, estado)

    if (CUENTA.has(estado)) r.diasAguinaldo++
    if (fecha <= hoy) {
      r.habilesHoy++
      if (CUENTA.has(estado)) r.asistidosHoy++
    }
    if (estado === 'registro') r.conRegistro++
    else if (estado === 'sin_registro') r.sinRegistro++
    else if (estado === 'falta' || estado === 'falta_auto') r.faltas++
    else if (estado === 'permiso') r.permisos++
    else if (estado === 'vacaciones') r.vacaciones++
    else if (estado === 'descanso') r.descansos++
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
  cada_meses: z.number().int().min(1).max(24).default(1),
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

const kmOpcional = z.number().int().min(0).max(10_000_000).nullish().transform((v) => v ?? null)
const camposCamion = {
  nombre: z.string().trim().min(1, 'Escribe el nombre o número del vehículo').max(60),
  placas: opcional(20),
  marca: opcional(60),
  modelo: opcional(60),
  anio: z.number().int().min(1950).max(2100).nullish().transform((v) => v ?? null),
  notas: opcional(500),
  activo: z.boolean().default(true),
  uso: z.enum(USOS).default('empresa'),
  aceite_cada_km: z.number().int().min(100).max(200_000).nullish().transform((v) => v ?? null),
  aceite_cada_meses: z.number().int().min(1).max(24).nullish().transform((v) => v ?? null),
  aceite_ultimo_km: kmOpcional,
  aceite_ultima_fecha: fecha.nullish().transform((v) => v ?? null),
}
export const esquemaCamion = z.object(camposCamion)
export const esquemaCambioCamion = z.object(camposCamion).partial()

/** Lectura del odómetro */
export const esquemaKilometraje = z.object({
  camion_id: z.number().int().positive(),
  fecha,
  km: z.number('Escribe el kilometraje').int().min(0).max(10_000_000),
  nota: opcional(200),
})

const camposDocumento = {
  camion_id: z.number().int().positive(),
  tipo: z.enum(TIPOS_DOCUMENTO, 'Elige el tipo de documento'),
  nombre: z.string().trim().min(2, 'Escribe el nombre del documento').max(120),
  vence: fecha.nullish().transform((v) => v ?? null),
  cada_meses: z.number().int().min(1).max(60).nullish().transform((v) => v ?? null),
  archivos: z.array(z.string().regex(RUTA_COMPROBANTE_TCG, 'Archivo inválido')).max(20, 'Máximo 20 archivos').default([]),
  notas: opcional(500),
}
export const esquemaDocumento = z.object(camposDocumento)
export const esquemaCambioDocumento = z.object(camposDocumento).partial()

const camposTrabajo = {
  camion_id: z.number('Elige el vehículo').int().positive('Elige el vehículo'),
  fecha,
  tipo: z.enum(TIPOS_TRABAJO, 'Elige el tipo de trabajo'),
  descripcion: z.string().trim().min(2, 'Describe el trabajo').max(500),
  taller: opcional(150),
  kilometraje: z.number().int().min(0).max(10_000_000).nullish().transform((v) => v ?? null),
  costo: z.number().min(0, 'El costo no puede ser negativo').max(10_000_000).default(0).transform(redondear),
  notas: opcional(500),
  cambio_aceite: z.boolean().default(false),
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
  sin_registro_es_falta: z.boolean().default(false),
}
export const esquemaEmpleado = z.object(camposEmpleado)
  .refine((d) => !d.fecha_ingreso || !d.fecha_baja || d.fecha_baja >= d.fecha_ingreso, { message: 'La baja no puede ser antes del ingreso', path: ['fecha_baja'] })
export const esquemaCambioEmpleado = z.object(camposEmpleado).partial()

export const esquemaMarcaAsistencia = z.object({
  empleado_id: z.number().int().positive(),
  fecha,
  /** Opcional: marca todos los días de `fecha` a `hasta` (vacaciones, descansos…) */
  hasta: fecha.optional(),
  /** null = quitar la marca y volver a lo automático */
  estado: z.enum(ESTADOS_MANUALES).nullable(),
  nota: opcional(200),
}).refine((d) => !d.hasta || d.hasta >= d.fecha, { message: 'La fecha final no puede ser antes de la inicial', path: ['hasta'] })
  .refine((d) => !d.hasta || diasEntre(d.fecha, d.hasta) <= 120, { message: 'Marca como mucho 4 meses de una vez', path: ['hasta'] })

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

import type { DatosCotizacionPDF, EmpresaPDF, ItemPDF, PagoPDF } from './pdf-cotizacion'
import type { DatosReportePDF } from './pdf-reporte'

// Arma los datos de los PDFs a partir de las filas de la BD.
// Lo usan tanto la descarga (/api/pdf/...) como el envío por correo (/api/correo),
// para que el cliente reciba exactamente el mismo documento por ambas vías.

type Fila = Record<string, unknown>

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const opcional = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : String(v))
const formatoPesos = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dinero = (v: unknown) => `$${formatoPesos.format(Number(v ?? 0))}`

export function fmtFechaPDF(d: unknown): string {
  if (!d) return ''
  return new Date(`${d}T00:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function empresaDeConfig(cfg: Fila | null): EmpresaPDF | undefined {
  if (!cfg) return undefined
  return {
    nombre:    texto(cfg.empresa_nombre ?? 'DIDARA TI'),
    direccion: texto(cfg.empresa_direccion),
    telefono:  texto(cfg.empresa_telefono),
    email:     texto(cfg.empresa_email),
    web:       texto(cfg.empresa_web),
  }
}

/** Datos bancarios; undefined si están ocultos o no hay banco configurado. */
export function pagoDeConfig(cfg: Fila | null): PagoPDF | undefined {
  if (!cfg || cfg.pago_mostrar === false || !cfg.pago_banco) return undefined
  return {
    banco:   texto(cfg.pago_banco),
    cuenta:  texto(cfg.pago_cuenta),
    clabe:   texto(cfg.pago_clabe),
    titular: texto(cfg.pago_titular),
  }
}

/**
 * Precio unitario que ve el cliente: ya incluye su descuento/recargo,
 * así no ve ni el precio base ni el porcentaje de ajuste.
 */
export function precioUnitarioCliente(item: Fila): number {
  return Number(item.precio_unitario ?? 0) * (1 - Number(item.descuento ?? 0) / 100)
}

export function datosPDFCotizacion(cot: Fila, cfg: Fila | null): DatosCotizacionPDF {
  const cliente = cot.cliente as Fila | null
  const rawItems: Fila[] = Array.isArray(cot.cotizacion_items) ? cot.cotizacion_items as Fila[] : []

  const items: ItemPDF[] = rawItems.map((item) => {
    const producto = item.producto as { imagen_url?: string | null } | null
    return {
      descripcion: texto(item.descripcion),
      cantidad: Number(item.cantidad ?? 0),
      precio_unitario: `$${precioUnitarioCliente(item).toFixed(2)}`,
      descuento: 0,
      subtotal: dinero(item.subtotal),
      imagen_url: texto(item.imagen_url).trim() || texto(producto?.imagen_url).trim() || null,
    }
  })

  return {
    folio: texto(cot.folio),
    fecha: texto(cot.fecha),
    vigencia: opcional(cot.vigencia),
    cliente_nombre: texto(cliente?.nombre),
    aplica_iva: Boolean(cot.aplica_iva),
    iva_porcentaje: texto(cot.iva_porcentaje ?? '0'),
    subtotal: dinero(cot.subtotal),
    iva_monto: dinero(cot.iva_monto),
    total: dinero(cot.total),
    notas: opcional(cot.notas),
    condiciones: opcional(cot.condiciones),
    elaborado_por: opcional(cot.elaborado_por),
    empresa: empresaDeConfig(cfg),
    pago: pagoDeConfig(cfg),
    items,
  }
}

export function datosPDFReporte(
  reporte: Fila,
  tecnicoNombre: string,
  cfg: Fila | null,
  firmaUrl?: string,
): DatosReportePDF {
  const cliente = reporte.cliente as Fila | null
  const rawItems: Fila[] = Array.isArray(reporte.items) ? reporte.items as Fila[] : []
  const sumaMateriales = rawItems.reduce((a, item) => a + Number(item.subtotal ?? 0), 0)

  return {
    folio: texto(reporte.folio),
    fecha_ingreso: fmtFechaPDF(reporte.fecha_ingreso),
    fecha_entrega: fmtFechaPDF(reporte.fecha_entrega) || undefined,
    cliente_nombre: texto(cliente?.nombre),
    direccion_servicio: opcional(reporte.direccion_servicio),
    tecnico_nombre: tecnicoNombre,
    equipo: texto(reporte.equipo),
    marca: opcional(reporte.marca),
    modelo: opcional(reporte.modelo),
    serie: opcional(reporte.serie),
    tipo_servicio: Array.isArray(reporte.tipo_servicio) ? reporte.tipo_servicio.map(texto) : [],
    falla_reportada: texto(reporte.falla_reportada),
    diagnostico: opcional(reporte.diagnostico),
    trabajos_realizados: Array.isArray(reporte.trabajos_realizados)
      ? reporte.trabajos_realizados.map(texto)
      : reporte.trabajo_realizado ? [texto(reporte.trabajo_realizado)] : [],
    observaciones: opcional(reporte.observaciones),
    evidencias: Array.isArray(reporte.evidencias) ? reporte.evidencias as DatosReportePDF['evidencias'] : [],
    items: rawItems.map((item) => ({
      descripcion: texto(item.descripcion),
      cantidad: Number(item.cantidad ?? 0),
      precio_unitario: dinero(item.precio_unitario),
      subtotal: dinero(item.subtotal),
    })),
    materiales_total: sumaMateriales > 0 ? dinero(sumaMateriales) : undefined,
    subtotal: dinero(reporte.subtotal),
    total: dinero(reporte.total),
    total_numero: Number(reporte.total ?? 0),
    firma_cliente: opcional(reporte.firma_cliente),
    firma_fecha: opcional(reporte.firma_fecha),
    firma_url: reporte.firma_fecha ? undefined : firmaUrl,
    estado: texto(reporte.estado),
    empresa: empresaDeConfig(cfg),
    pago: pagoDeConfig(cfg),
  }
}

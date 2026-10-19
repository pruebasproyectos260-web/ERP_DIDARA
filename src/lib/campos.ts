import { NextResponse } from 'next/server'
import { z } from 'zod'

z.config(z.locales.es())

// ─── Columnas editables por tabla ──────────────────────────────
// Lo que llegue del navegador fuera de esta lista se ignora: así nadie puede
// cambiar id, folio, created_by, codigo, activo, etc. con una petición manual.

export const CAMPOS = {
  clientes: [
    'nombre', 'rfc', 'direccion', 'telefono', 'email', 'contactos', 'notas',
    'direcciones', 'tiene_poliza', 'regimen_fiscal', 'uso_cfdi', 'descuento',
  ],
  productos: [
    'nombre', 'descripcion', 'categoria', 'categorias', 'unidad',
    'precio_venta', 'precio_venta_incluye_iva', 'iva_venta',
    'precio_compra_neto', 'precio_compra_incluye_iva', 'iva_compra', 'precio_compra_con_iva',
    'stock', 'stock_minimo', 'clave_sat_producto', 'clave_sat_unidad', 'imagen_url',
  ],
  cotizaciones: [
    'cliente_id', 'fecha', 'vigencia', 'estado', 'aplica_iva', 'iva_porcentaje',
    'subtotal', 'iva_monto', 'total', 'notas', 'condiciones', 'ganancia_total',
    'quien_es_el_cliente', 'direccion_entrega', 'contactos_cotizacion', 'ganancia_real', 'pct_didara',
  ],
  cotizacion_items: [
    'tipo', 'descripcion', 'cantidad', 'precio_unitario', 'descuento', 'subtotal',
    'producto_id', 'precio_compra', 'cantidad_recuperada', 'imagen_url',
  ],
  reportes: [
    'cliente_id', 'fecha_ingreso', 'fecha_entrega', 'equipo', 'marca', 'modelo', 'serie',
    'falla_reportada', 'diagnostico', 'trabajo_realizado', 'estado', 'subtotal', 'total',
    'firma_cliente', 'firma_fecha', 'tecnico_id', 'tipo_servicio', 'trabajos_realizados',
    'observaciones', 'direccion_servicio', 'evidencias',
  ],
  reporte_items: ['descripcion', 'cantidad', 'precio_unitario', 'subtotal'],
  eventos: [
    'titulo', 'descripcion', 'tipo', 'fecha_inicio', 'fecha_fin', 'todo_el_dia', 'cliente_id',
    'color', 'lugar', 'contacto', 'responsables', 'estado', 'notas_adicionales',
  ],
  pendientes: [
    'cliente_id', 'cliente_nombre', 'contacto_nombre', 'tecnico_ids', 'descripcion',
    'fecha_solicitud', 'fecha_max_entrega', 'estado',
  ],
  software:          ['nombre', 'enlace', 'descripcion'],
  gastos_fijos:      ['nombre', 'monto', 'dia', 'fecha_inicio', 'notas'],
  gastos_variables:  ['fecha', 'tipo', 'descripcion', 'monto', 'metodo_pago'],
  ganancias_fijas:   ['descripcion', 'monto', 'dia', 'fecha_inicio', 'notas'],
  ingresos_manuales: ['fecha', 'descripcion', 'monto', 'notas'],
  ventas: [
    'folio_referencia', 'tipo', 'cliente_id', 'fecha', 'subtotal', 'iva_monto', 'total',
    'costo_total', 'ganancia', 'metodo_pago', 'notas',
  ],
  gastos: ['descripcion', 'categoria', 'tipo', 'monto', 'fecha', 'recurrente', 'periodo', 'comprobante_url'],
} as const

type Fila = Record<string, unknown>

/** Lee el JSON del request; si no es un objeto válido devuelve {}. */
export async function leerJson(req: Request): Promise<Fila> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  } catch {
    return {}
  }
}

/** Conserva solo las columnas permitidas. */
export function pick(obj: unknown, campos: readonly string[]): Fila {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
  const src = obj as Fila
  const out: Fila = {}
  for (const c of campos) if (c in src) out[c] = src[c]
  return out
}

/** Igual que pick() pero para arreglos de partidas. undefined si no se envió un arreglo. */
export function pickItems(items: unknown, campos: readonly string[]): Fila[] | undefined {
  return Array.isArray(items) ? items.map((it) => pick(it, campos)) : undefined
}

/** Quita caracteres que alteran la sintaxis de filtros de PostgREST en .or() */
export function limpiarBusqueda(q: string): string {
  return q.replace(/[,()*\\]/g, ' ').trim()
}

/** Responde 400 con el primer mensaje de validación de zod. */
export function errorValidacion(error: z.ZodError) {
  return NextResponse.json({ error: error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
}


// ─── Costos ocultos para nivel 3 (restringido) ─────────────────
// El nivel 2 sí trabaja con precios de compra (cotizaciones y productos);
// el nivel 3 no debe recibirlos ni en el payload del navegador.

const COSTOS_PRODUCTO     = ['precio_compra_neto', 'precio_compra_incluye_iva', 'iva_compra', 'precio_compra_con_iva']
const COSTOS_COTIZACION   = ['ganancia_total', 'ganancia_real', 'pct_didara']
const COSTOS_PARTIDA      = ['precio_compra']

function omitir<T extends object>(obj: T, campos: readonly string[]): T {
  const copia = { ...obj } as Fila
  for (const c of campos) delete copia[c]
  return copia as T
}

export function ocultarCostosProducto<T extends object>(producto: T): T {
  return omitir(producto, COSTOS_PRODUCTO)
}

export function ocultarCostosCotizacion<T extends object>(cotizacion: T): T {
  const copia = omitir(cotizacion, COSTOS_COTIZACION) as Fila
  for (const k of ['items', 'cotizacion_items']) {
    if (Array.isArray(copia[k])) copia[k] = (copia[k] as object[]).map((it) => omitir(it, COSTOS_PARTIDA))
  }
  return copia as T
}

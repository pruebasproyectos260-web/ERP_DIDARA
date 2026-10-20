import ExcelJS from 'exceljs'
import type { DatosContables } from '@/lib/contabilidad'
import { nombreMes } from '@/lib/finanzas'

// Excel para contabilidad: Resumen · Ingresos · Gastos · Pendientes.

const MARCA = 'FF187D78'
const MONEDA = '"$"#,##0.00'
const FECHA = 'dd/mm/yyyy'

const fecha = (f: string) => new Date(`${f}T12:00:00Z`)
const urlComprobante = (origen: string, ruta: string) => `${origen}/api/finanzas/comprobantes?ruta=${encodeURIComponent(ruta)}`

function encabezado(hoja: ExcelJS.Worksheet, fila: number) {
  const r = hoja.getRow(fila)
  r.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  r.alignment = { vertical: 'middle' }
  r.height = 20
  r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARCA } } })
}

/** Tabla con encabezado fijo, filtros, formatos y fila de totales */
function tabla(
  hoja: ExcelJS.Worksheet,
  columnas: { titulo: string; ancho: number; tipo?: 'moneda' | 'fecha' }[],
  filas: (string | number | Date | ExcelJS.CellHyperlinkValue)[][],
  totales: number[], // índices de columnas que se suman
) {
  hoja.columns = columnas.map((c) => ({ width: c.ancho }))
  hoja.addRow(columnas.map((c) => c.titulo))
  encabezado(hoja, 1)
  filas.forEach((f) => hoja.addRow(f))
  columnas.forEach((c, i) => {
    const col = hoja.getColumn(i + 1)
    if (c.tipo === 'moneda') col.numFmt = MONEDA
    if (c.tipo === 'fecha') col.numFmt = FECHA
  })
  hoja.views = [{ state: 'frozen', ySplit: 1 }]
  if (filas.length) {
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: filas.length + 1, column: columnas.length } }
    const fila = hoja.addRow([])
    fila.getCell(1).value = 'TOTAL'
    for (const i of totales) {
      const letra = hoja.getColumn(i + 1).letter
      const resultado = filas.reduce((a, f) => a + (typeof f[i] === 'number' ? f[i] as number : 0), 0)
      fila.getCell(i + 1).value = { formula: `SUM(${letra}2:${letra}${filas.length + 1})`, result: Math.round(resultado * 100) / 100 }
    }
    fila.font = { bold: true }
    fila.eachCell((c) => { c.border = { top: { style: 'thin', color: { argb: 'FF9CA3AF' } } } })
  } else {
    hoja.addRow(['Sin movimientos en el periodo'])
  }
}

export async function excelContable(d: DatosContables, origen: string): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Didara ERP'
  libro.created = new Date()

  // ── Resumen ──
  const res = libro.addWorksheet('Resumen', { properties: { tabColor: { argb: MARCA } } })
  res.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }]
  res.addRow(['Didara TI — Reporte para contabilidad']).font = { bold: true, size: 14, color: { argb: MARCA } }
  res.addRow([`Periodo: ${d.titulo}`]).font = { bold: true }
  res.addRow([`Generado: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'long', timeStyle: 'short' })}`]).font = { color: { argb: 'FF6B7280' } }
  res.addRow([])
  const r = d.resumen
  res.addRow(['Concepto', 'Con factura', 'Sin factura', 'Total'])
  encabezado(res, 5)
  const filasResumen: [string, number, number, number][] = [
    ['Ingresos sin IVA (subtotal)', r.ingresos.conFactura.subtotal, r.ingresos.sinFactura.subtotal, r.ingresos.conFactura.subtotal + r.ingresos.sinFactura.subtotal],
    ['IVA cobrado (trasladado)', r.ingresos.conFactura.iva, 0, r.ingresos.conFactura.iva],
    ['Total cobrado', r.ingresos.conFactura.total, r.ingresos.sinFactura.total, r.ingresos.total],
    ['Gastos sin IVA (subtotal)', r.gastos.conFactura.subtotal, r.gastos.sinFactura.subtotal, r.gastos.conFactura.subtotal + r.gastos.sinFactura.subtotal],
    ['IVA pagado (acreditable)', r.gastos.conFactura.iva, 0, r.gastos.conFactura.iva],
    ['Total pagado', r.gastos.conFactura.total, r.gastos.sinFactura.total, r.gastos.total],
  ]
  filasResumen.forEach((f, i) => {
    const fila = res.addRow(f)
    if (i === 2 || i === 5) fila.font = { bold: true }
  })
  res.addRow([])
  res.addRow(['IVA del periodo (estimado)']).font = { bold: true }
  res.addRow(['IVA cobrado', '', '', r.iva.cobrado])
  res.addRow(['IVA pagado (acreditable)', '', '', r.iva.pagado])
  res.addRow([r.iva.diferencia >= 0 ? 'IVA por pagar' : 'IVA a favor', '', '', Math.abs(r.iva.diferencia)]).font = { bold: true }
  res.addRow([])
  const filaCat = res.rowCount + 1
  res.addRow(['Gastos por categoría', 'Total', 'Con factura'])
  encabezado(res, filaCat)
  r.porCategoria.forEach((c) => res.addRow([c.categoria, c.total, c.conFactura]))
  res.addRow([])
  res.addRow(['Notas:']).font = { bold: true }
  res.addRow(['• Los cobros se capturan sin IVA; si llevan factura se les suma el IVA.'])
  res.addRow(['• Los gastos con factura traen el IVA incluido; aquí se separa.'])
  res.addRow(['• Estimación de apoyo: el cálculo oficial lo hace contabilidad.'])
  for (let i = 6; i <= res.rowCount; i++) for (const c of [2, 3, 4]) res.getRow(i).getCell(c).numFmt = MONEDA

  // ── Ingresos ──
  tabla(libro.addWorksheet('Ingresos'), [
    { titulo: 'Fecha', ancho: 12, tipo: 'fecha' }, { titulo: 'Cliente', ancho: 32 }, { titulo: 'RFC', ancho: 15 },
    { titulo: 'Concepto', ancho: 36 }, { titulo: 'Folio', ancho: 11 }, { titulo: 'Categoría', ancho: 14 },
    { titulo: 'Forma de pago', ancho: 17 }, { titulo: 'Factura', ancho: 9 },
    { titulo: 'Subtotal', ancho: 14, tipo: 'moneda' }, { titulo: 'IVA', ancho: 13, tipo: 'moneda' }, { titulo: 'Total', ancho: 14, tipo: 'moneda' },
    { titulo: 'Registró', ancho: 22 },
  ], d.ingresos.map((i) => [fecha(i.fecha), i.cliente, i.rfc, i.concepto, i.folio, i.categoria, i.metodo, i.factura ? 'Sí' : 'No', i.subtotal, i.iva, i.total, i.registro]),
  [8, 9, 10])

  // ── Gastos ──
  tabla(libro.addWorksheet('Gastos'), [
    { titulo: 'Fecha', ancho: 12, tipo: 'fecha' }, { titulo: 'Proveedor / lugar', ancho: 24 }, { titulo: 'Concepto', ancho: 32 },
    { titulo: 'Categoría', ancho: 14 }, { titulo: 'Forma de pago', ancho: 17 }, { titulo: 'Factura', ancho: 9 },
    { titulo: 'Subtotal', ancho: 14, tipo: 'moneda' }, { titulo: 'IVA', ancho: 13, tipo: 'moneda' }, { titulo: 'Total', ancho: 14, tipo: 'moneda' },
    { titulo: 'Registró', ancho: 22 }, { titulo: 'Revisó', ancho: 22 }, { titulo: 'Comprobante', ancho: 13 },
  ], d.gastos.map((g) => [
    fecha(g.fecha), g.proveedor, g.concepto, g.categoria, g.metodo, g.factura ? 'Sí' : 'No', g.subtotal, g.iva, g.total,
    g.registro, g.revisado ? g.reviso || 'Sí' : 'Pendiente',
    g.comprobantes.length
      ? { text: g.comprobantes.length > 1 ? `Ver (${g.comprobantes.length})` : 'Ver', hyperlink: urlComprobante(origen, g.comprobantes[0]) }
      : '—',
  ]), [6, 7, 8])
  const hojaGastos = libro.getWorksheet('Gastos')!
  hojaGastos.getColumn(12).eachCell((c, i) => { if (i > 1 && typeof c.value === 'object' && c.value) c.font = { color: { argb: 'FF187D78' }, underline: true } })

  // ── Pendientes ──
  const pen = libro.addWorksheet('Pendientes', { properties: { tabColor: { argb: 'FFF59E0B' } } })
  pen.columns = [{ width: 14 }, { width: 34 }, { width: 34 }, { width: 16 }, { width: 18 }]
  const p = d.pendientes
  const seccion = (titulo: string, cols: string[], filas: (string | number | Date)[][], monedaEn: number[] = []) => {
    pen.addRow([`${titulo} (${filas.length})`]).font = { bold: true, size: 12, color: { argb: MARCA } }
    if (!filas.length) { pen.addRow(['Sin pendientes ✓']).font = { color: { argb: 'FF16A34A' } }; pen.addRow([]); return }
    pen.addRow(cols)
    encabezado(pen, pen.rowCount)
    filas.forEach((f) => {
      const fila = pen.addRow(f)
      f.forEach((v, i) => { if (v instanceof Date) fila.getCell(i + 1).numFmt = FECHA })
      monedaEn.forEach((i) => { fila.getCell(i + 1).numFmt = MONEDA })
    })
    pen.addRow([])
  }
  seccion('Gastos con factura sin foto del comprobante', ['Fecha', 'Proveedor', 'Concepto', 'Total', 'Registró'],
    p.gastosSinComprobante.map((g) => [fecha(g.fecha), g.proveedor, g.concepto || g.categoria, g.total, g.registro]), [3])
  seccion('Ingresos con factura sin IVA capturado', ['Fecha', 'Cliente', 'Concepto', 'Total', 'Folio'],
    p.ingresosSinIva.map((i) => [fecha(i.fecha), i.cliente, i.concepto, i.total, i.folio]), [3])
  seccion('Gastos sin revisar', ['Fecha', 'Proveedor', 'Concepto', 'Total', 'Registró'],
    p.gastosSinRevisar.map((g) => [fecha(g.fecha), g.proveedor, g.concepto || g.categoria, g.total, g.registro]), [3])
  seccion('Pagos y cobros fijos sin marcar', ['Mes', 'Concepto', 'Tipo', 'Monto'],
    p.fijosSinMarcar.map((f) => [nombreMes(f.mes), f.nombre, f.tipo === 'gasto' ? 'Pago' : 'Cobro', f.monto]), [3])
  seccion('Lo que nos deben (al día de hoy)', ['Fecha', 'Cliente', 'Documento', 'Pendiente', 'Factura'],
    p.porCobrar.map((c) => [fecha(c.fecha), c.cliente, c.folio, c.saldo, c.con_factura ? 'Sí (IVA incluido)' : 'No']), [3])

  return Buffer.from(await libro.xlsx.writeBuffer())
}

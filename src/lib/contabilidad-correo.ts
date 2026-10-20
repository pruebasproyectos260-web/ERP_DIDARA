import type { Sesion } from '@/lib/auth'
import { enviarCorreo } from '@/lib/correo'
import { escaparHtml } from '@/lib/html'
import { CORREO_DIRECCION, botonCorreo, plantillaCorreo } from '@/lib/plantilla-correo'
import { formatoMoneda, rangoMes } from '@/lib/finanzas'
import { datosContables } from '@/lib/contabilidad'
import { excelContable } from '@/lib/excel-contable'

type Supabase = Sesion['supabase']

/** Contadores activos con correo; si no hay, dirección. Dirección siempre en copia. */
export async function destinatariosContables(supabase: Supabase) {
  const { data } = await supabase.from('usuarios').select('correo').eq('activo', true).eq('es_contador', true)
  const contadores = [...new Set((data ?? []).map((u) => u.correo as string | null).filter((c): c is string => !!c?.includes('@')))]
  return contadores.length
    ? { para: contadores, cc: contadores.includes(CORREO_DIRECCION) ? [] : [CORREO_DIRECCION] }
    : { para: [CORREO_DIRECCION], cc: [] }
}

export function nombreArchivo(desde: string, hasta: string) {
  const mes = desde.slice(0, 7)
  const r = rangoMes(mes)
  return desde === r.desde && hasta === r.hasta ? `Didara-contabilidad-${mes}.xlsx` : `Didara-contabilidad-${desde}_a_${hasta}.xlsx`
}

/** Genera el Excel del periodo y lo manda por correo a contabilidad */
export async function enviarReporteContable(supabase: Supabase, origen: string, desde: string, hasta: string) {
  const datos = await datosContables(supabase, desde, hasta)
  const excel = await excelContable(datos, origen)
  const { para, cc } = await destinatariosContables(supabase)
  const r = datos.resumen
  const p = datos.pendientes
  const fila = (a: string, b: string, fuerte = false) =>
    `<tr><td style="color:#64748b;padding:4px 12px 4px 0;">${a}</td><td style="text-align:right;${fuerte ? 'font-weight:bold;' : ''}">${b}</td></tr>`
  const pendientes = [
    [p.gastosSinComprobante.length, 'gastos con factura sin foto'],
    [p.ingresosSinIva.length, 'ingresos con factura sin IVA capturado'],
    [p.gastosSinRevisar.length, 'gastos sin revisar'],
    [p.fijosSinMarcar.length, 'pagos/cobros fijos sin marcar'],
  ].filter(([n]) => Number(n) > 0)

  const contenido = `
    <p style="margin:0 0 14px;color:#374151;">Adjunto el Excel con ingresos, gastos, IVA y pendientes de <strong>${escaparHtml(datos.titulo)}</strong>.</p>
    <table cellpadding="0" style="border-collapse:collapse;font-size:.9rem;color:#374151;">
      ${fila('Ingresos (total cobrado)', formatoMoneda(r.ingresos.total))}
      ${fila('Gastos (total pagado)', formatoMoneda(r.gastos.total))}
      ${fila('IVA cobrado', formatoMoneda(r.iva.cobrado))}
      ${fila('IVA pagado (acreditable)', formatoMoneda(r.iva.pagado))}
      ${fila(r.iva.diferencia >= 0 ? 'IVA estimado por pagar' : 'IVA estimado a favor', formatoMoneda(Math.abs(r.iva.diferencia)), true)}
    </table>
    ${pendientes.length ? `<p style="margin:16px 0 4px;color:#92400e;font-weight:bold;">Pendientes por revisar:</p>
      <ul style="margin:0;padding-left:18px;color:#92400e;font-size:.9rem;">${pendientes.map(([n, t]) => `<li>${n} ${t}</li>`).join('')}</ul>` : ''}
    ${botonCorreo('Abrir contabilidad en el ERP', `${origen}/finanzas?vista=contabilidad`)}`

  await enviarCorreo({
    para, cc,
    asunto: `Contabilidad ${datos.titulo} — Didara TI`,
    html: plantillaCorreo('Reporte para contabilidad', escaparHtml(datos.titulo), contenido),
    adjuntos: [{ filename: nombreArchivo(desde, hasta), content: excel, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
  })
  return { para, cc, titulo: datos.titulo }
}

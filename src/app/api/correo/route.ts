import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { leerJson } from '@/lib/campos'
import { escaparHtml, escaparMultilinea } from '@/lib/html'
import { urlFirma } from '@/lib/firma'
import { enviarCorreo } from '@/lib/correo'
import { generarPDFCotizacion } from '@/lib/pdf-cotizacion'
import { generarPDFReporte } from '@/lib/pdf-reporte'
import { datosPDFCotizacion, datosPDFReporte, precioUnitarioCliente } from '@/lib/pdf-datos'

const CC_FIJO = 'direccion@didara-ti.com'
const AÑO = new Date().getFullYear()

function fmtDate(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmt$(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

function emailLayout(titulo: string, subtitulo: string, contenido: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f1f5f9;font-family:Arial,sans-serif;">
<div style="max-width:640px;margin:0 auto;">
  <div style="background:#137D79;color:#fff;padding:22px 28px;border-radius:10px 10px 0 0;">
    <h2 style="margin:0;font-size:1.25rem;font-weight:800;">${titulo}</h2>
    <p style="margin:6px 0 0;opacity:.85;font-size:.85rem;">${subtitulo}</p>
  </div>
  <div style="background:#ffffff;padding:26px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
    ${contenido}
    <hr style="margin:24px 0;border:none;border-top:1px solid #f1f5f9;">
    <p style="margin:0;font-size:.78rem;color:#94a3b8;text-align:center;">
      Este mensaje fue enviado automáticamente por el sistema ERP de <strong>Didara TI</strong>.<br>
      Si tienes dudas, responde este correo o escríbenos a
      <a href="mailto:direccion@didara-ti.com" style="color:#137D79;">direccion@didara-ti.com</a>
    </p>
  </div>
  <p style="text-align:center;font-size:.72rem;color:#94a3b8;margin-top:12px;">
    © ${AÑO} Didara TI &nbsp;·&nbsp; didarobot@didara-ti.com
  </p>
</div>
</body></html>`
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth

  const { destinatarios, mensaje_adicional, cotizacion_id, reporte_id, adjuntar_pdf } = await leerJson(req)

  const emails: string[] = Array.isArray(destinatarios)
    ? destinatarios.filter((e): e is string => typeof e === 'string' && e.includes('@'))
    : []
  if (!emails.length) {
    return NextResponse.json({ error: 'Selecciona al menos un destinatario.' }, { status: 400 })
  }

  let asunto = ''
  let html = ''
  let adjuntos: { filename: string; content: Buffer; contentType: string }[] = []

  // El mensaje es texto libre: se escapa para que no se pueda inyectar HTML en el correo
  const msgExtraHtml = typeof mensaje_adicional === 'string' && mensaje_adicional.trim()
    ? `<hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0;"><p style="font-size:.88rem;color:#374151;">${escaparMultilinea(mensaje_adicional)}</p>`
    : ''

  try {
    if (cotizacion_id) {
      const [{ data: cot }, { data: cfg }] = await Promise.all([
        supabase.from('cotizaciones')
          .select('*, cliente:clientes(*), cotizacion_items(*, producto:productos(imagen_url))')
          .eq('id', cotizacion_id)
          .single(),
        supabase.from('configuracion').select('*').eq('id', 1).single(),
      ])

      if (!cot) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

      const clienteNombre = (cot.cliente as { nombre?: string } | null)?.nombre ?? ''
      const rawItems: Record<string, unknown>[] = Array.isArray(cot.cotizacion_items) ? cot.cotizacion_items : []

      const itemsHtml = rawItems.map((item) => `
        <tr>
          <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${escaparMultilinea(item.descripcion)}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${escaparHtml(item.cantidad ?? 0)}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmt$(precioUnitarioCliente(item))}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${fmt$(Number(item.subtotal ?? 0))}</td>
        </tr>`).join('')

      const notaPdf = adjuntar_pdf
        ? `<p style="margin:16px 0 0;font-size:.85rem;color:#374151;"><i>El PDF de la cotización se adjunta a este correo.</i></p>`
        : ''

      asunto = `Cotización ${cot.folio} — Didara TI`

      const contenido = `
        <p style="margin:0 0 14px;color:#374151;">Estimado(a) <strong>${escaparHtml(clienteNombre)}</strong>,</p>
        <p style="margin:0 0 20px;color:#374151;">Le compartimos la cotización solicitada con los siguientes conceptos:</p>
        <table style="width:100%;border-collapse:collapse;font-size:.88rem;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:9px 10px;text-align:left;color:#475569;">Producto / Servicio</th>
              <th style="padding:9px 10px;text-align:center;color:#475569;">Cant.</th>
              <th style="padding:9px 10px;text-align:right;color:#475569;">P. Unit.</th>
              <th style="padding:9px 10px;text-align:right;color:#475569;">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr style="background:#f8fafc;">
              ${cot.aplica_iva ? `<td colspan="3" style="padding:7px 10px;text-align:right;color:#475569;">IVA (${escaparHtml(cot.iva_porcentaje)}%):</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${fmt$(Number(cot.iva_monto ?? 0))}</td></tr><tr style="background:#f8fafc;">` : ''}
              <td colspan="3" style="padding:10px;text-align:right;font-weight:700;color:#1e293b;">Total:</td>
              <td style="padding:10px;text-align:right;font-weight:800;font-size:1.05rem;color:#16a34a;">${fmt$(Number(cot.total ?? 0))}</td>
            </tr>
          </tfoot>
        </table>
        ${cot.notas ? `<p style="margin:16px 0 0;font-size:.85rem;color:#64748b;"><strong>Notas:</strong> ${escaparMultilinea(cot.notas)}</p>` : ''}
        ${notaPdf}
        ${msgExtraHtml}
      `

      html = emailLayout(`Cotización ${escaparHtml(cot.folio)}`, `Didara TI &nbsp;·&nbsp; ${fmtDate(cot.fecha)}`, contenido)

      if (adjuntar_pdf) {
        // Mismo PDF que la descarga (precio con descuento aplicado, datos de pago)
        const pdfBuffer = await generarPDFCotizacion(datosPDFCotizacion(cot, cfg))

        adjuntos = [{ filename: `Cotizacion_${cot.folio}.pdf`, content: Buffer.from(pdfBuffer), contentType: 'application/pdf' }]
      }

    } else if (reporte_id) {
      const [{ data: reporte }, { data: cfg }] = await Promise.all([
        supabase.from('reportes')
          .select('*, cliente:clientes(*), items:reporte_items(*)')
          .eq('id', reporte_id)
          .single(),
        supabase.from('configuracion').select('*').eq('id', 1).single(),
      ])

      if (!reporte) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })

      const clienteNombre = (reporte.cliente as { nombre?: string } | null)?.nombre ?? ''

      const { data: tecnicoRow } = reporte.tecnico_id
        ? await supabase.from('usuarios').select('id, nombre').eq('id', reporte.tecnico_id).single()
        : { data: null }
      const tecnicoNombre = (tecnicoRow as { nombre?: string } | null)?.nombre ?? ''

      const notaPdf = adjuntar_pdf
        ? `<p style="margin:16px 0 0;font-size:.85rem;color:#374151;"><i>El reporte completo se adjunta a este correo en formato PDF.</i></p>`
        : ''

      asunto = `Reporte de Servicio ${reporte.folio} — Didara TI`

      const firmaUrl = reporte.firma_fecha ? undefined : urlFirma(req, reporte.id)
      const botonFirma = firmaUrl
        ? `<p style="margin:22px 0 6px;color:#374151;">Para confirmar que el servicio quedó a su entera satisfacción, le pedimos firmar de conformidad:</p>
           <p style="margin:0 0 6px;"><a href="${escaparHtml(firmaUrl)}" style="display:inline-block;background:#137D79;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 22px;border-radius:8px;">Firmar de conformidad</a></p>`
        : ''

      const contenido = `
        <p style="margin:0 0 14px;color:#374151;">Estimado(a) <strong>${escaparHtml(clienteNombre)}</strong>,</p>
        <p style="margin:0 0 18px;color:#374151;">Le informamos que el reporte de servicio <strong>${escaparHtml(reporte.folio)}</strong> ha sido procesado.</p>
        ${botonFirma}
        ${notaPdf}
        ${msgExtraHtml}
      `

      html = emailLayout(`Reporte de Servicio ${escaparHtml(reporte.folio)}`, 'Didara TI', contenido)

      if (adjuntar_pdf) {
        const pdfBuffer = await generarPDFReporte(datosPDFReporte(reporte, tecnicoNombre, cfg, firmaUrl))

        adjuntos = [{ filename: `Reporte_${reporte.folio}.pdf`, content: Buffer.from(pdfBuffer), contentType: 'application/pdf' }]
      }
    } else {
      return NextResponse.json({ error: 'Se requiere cotizacion_id o reporte_id' }, { status: 400 })
    }

    // Destinatarios: los seleccionados van en "to", CC_FIJO siempre en CC
    await enviarCorreo({
      para: emails,
      cc: CC_FIJO,
      asunto,
      html,
      adjuntos: adjuntos.length > 0 ? adjuntos : undefined,
    })

    return NextResponse.json({ ok: true, enviado_a: emails.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Error enviando correo:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

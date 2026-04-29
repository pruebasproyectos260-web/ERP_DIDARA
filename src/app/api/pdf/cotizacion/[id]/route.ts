import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generarPDFCotizacion, type ItemPDF } from '@/lib/pdf-cotizacion'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: cot, error }, { data: cfg }] = await Promise.all([
    supabase
      .from('cotizaciones')
      .select('*, cliente:clientes(*), cotizacion_items(*, producto:productos(imagen_url))')
      .eq('id', id)
      .single(),
    supabase.from('configuracion').select('*').eq('id', 1).single(),
  ])

  if (error || !cot) {
    return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
  }

  const cliente = cot.cliente as Record<string, string> | null

  const rawItems: Record<string, unknown>[] = Array.isArray(cot.cotizacion_items)
    ? cot.cotizacion_items
    : []

  const items: ItemPDF[] = rawItems.map((item) => {
    const producto = item.producto as { imagen_url?: string | null } | null
    const imagenUrl =
      String(item.imagen_url ?? '').trim() ||
      String(producto?.imagen_url ?? '').trim() ||
      null
    return {
      descripcion: String(item.descripcion ?? ''),
      cantidad: Number(item.cantidad ?? 0),
      precio_unitario: `$${Number(item.precio_unitario ?? 0).toFixed(2)}`,
      descuento: Number(item.descuento ?? 0),
      subtotal: `$${Number(item.subtotal ?? 0).toFixed(2)}`,
      imagen_url: imagenUrl,
    }
  })

  const cfgRow = cfg as Record<string, string> | null

  try {
    const pdfBuffer = await generarPDFCotizacion({
      folio: cot.folio ?? '',
      fecha: cot.fecha ?? '',
      vigencia: cot.vigencia ?? undefined,
      cliente_nombre: cliente?.nombre ?? '',
      aplica_iva: Boolean(cot.aplica_iva),
      iva_porcentaje: cot.iva_porcentaje?.toString() ?? '0',
      subtotal: `$${Number(cot.subtotal ?? 0).toFixed(2)}`,
      iva_monto: `$${Number(cot.iva_monto ?? 0).toFixed(2)}`,
      total: `$${Number(cot.total ?? 0).toFixed(2)}`,
      notas: cot.notas ?? undefined,
      condiciones: cot.condiciones ?? undefined,
      elaborado_por: cot.elaborado_por ?? undefined,
      empresa: cfgRow ? {
        nombre:    cfgRow.empresa_nombre    ?? 'DIDARA TI',
        direccion: cfgRow.empresa_direccion ?? '',
        telefono:  cfgRow.empresa_telefono  ?? '',
        email:     cfgRow.empresa_email     ?? '',
        web:       cfgRow.empresa_web       ?? '',
      } : undefined,
      items,
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="cotizacion-${cot.folio}.pdf"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('Error generando PDF:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

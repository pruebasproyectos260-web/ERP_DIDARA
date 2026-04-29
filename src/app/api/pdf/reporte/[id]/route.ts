import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generarPDFReporte } from '@/lib/pdf-reporte'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: reporte, error }, { data: cfg }] = await Promise.all([
    supabase
      .from('reportes')
      .select('*, cliente:clientes(*), items:reporte_items(*)')
      .eq('id', id)
      .single(),
    supabase.from('configuracion').select('*').eq('id', 1).single(),
  ])

  if (error || !reporte) {
    return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
  }

  // Resolver técnico por tecnico_id (no hay FK a public.usuarios)
  const { data: tecnicoRow } = reporte.tecnico_id
    ? await supabase.from('usuarios').select('id, nombre').eq('id', reporte.tecnico_id).single()
    : { data: null }

  const cliente = reporte.cliente as Record<string, string> | null
  const tecnico = tecnicoRow as Record<string, string> | null
  const cfgRow  = cfg as Record<string, string> | null

  const items = Array.isArray(reporte.items)
    ? reporte.items.map((item: Record<string, unknown>) => ({
        descripcion:    String(item.descripcion ?? ''),
        cantidad:       Number(item.cantidad ?? 0),
        precio_unitario: `$${Number(item.precio_unitario ?? 0).toFixed(2)}`,
        subtotal:        `$${Number(item.subtotal ?? 0).toFixed(2)}`,
      }))
    : []

  function fmtDate(d: string | null | undefined) {
    if (!d) return ''
    return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  try {
    const pdfBuffer = await generarPDFReporte({
      folio:            reporte.folio ?? '',
      fecha_ingreso:    fmtDate(reporte.fecha_ingreso),
      fecha_entrega:    fmtDate(reporte.fecha_entrega) || undefined,
      cliente_nombre:   cliente?.nombre ?? '',
      direccion_servicio: reporte.direccion_servicio ?? undefined,
      tecnico_nombre:   tecnico?.nombre ?? '',
      equipo:           reporte.equipo ?? '',
      marca:            reporte.marca ?? undefined,
      modelo:           reporte.modelo ?? undefined,
      serie:            reporte.serie ?? undefined,
      tipo_servicio:    Array.isArray(reporte.tipo_servicio) ? reporte.tipo_servicio : [],
      falla_reportada:  reporte.falla_reportada ?? '',
      diagnostico:      reporte.diagnostico ?? undefined,
      trabajos_realizados: Array.isArray(reporte.trabajos_realizados)
        ? reporte.trabajos_realizados
        : reporte.trabajo_realizado
          ? [reporte.trabajo_realizado]
          : [],
      observaciones:    reporte.observaciones ?? undefined,
      evidencias:       Array.isArray(reporte.evidencias) ? reporte.evidencias : [],
      items,
      subtotal: `$${Number(reporte.subtotal ?? 0).toFixed(2)}`,
      total:    `$${Number(reporte.total ?? 0).toFixed(2)}`,
      firma_cliente: reporte.firma_cliente ?? undefined,
      firma_fecha:   reporte.firma_fecha ?? undefined,
      estado:        reporte.estado ?? '',
      empresa: cfgRow ? {
        nombre:    cfgRow.empresa_nombre    ?? 'DIDARA TI',
        direccion: cfgRow.empresa_direccion ?? '',
        telefono:  cfgRow.empresa_telefono  ?? '',
        email:     cfgRow.empresa_email     ?? '',
        web:       cfgRow.empresa_web       ?? '',
      } : undefined,
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="reporte-${reporte.folio}.pdf"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('Error generando PDF reporte:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

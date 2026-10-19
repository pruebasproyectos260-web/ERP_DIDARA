import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { generarPDFReporte } from '@/lib/pdf-reporte'
import { datosPDFReporte } from '@/lib/pdf-datos'
import { urlFirma } from '@/lib/firma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

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

  try {
    const pdfBuffer = await generarPDFReporte(
      datosPDFReporte(reporte, tecnicoRow?.nombre ?? '', cfg, urlFirma(req, reporte.id))
    )

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

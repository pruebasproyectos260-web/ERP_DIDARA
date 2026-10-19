import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { generarPDFCotizacion } from '@/lib/pdf-cotizacion'
import { datosPDFCotizacion } from '@/lib/pdf-datos'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

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

  try {
    const pdfBuffer = await generarPDFCotizacion(datosPDFCotizacion(cot, cfg))

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

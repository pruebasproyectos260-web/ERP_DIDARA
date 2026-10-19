import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { tokenFirma } from '@/lib/firma'

// Devuelve el token del enlace público de firma; la URL completa se arma en el navegador
// (detrás del proxy de Render el origin del servidor no es el público).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { data: reporte } = await auth.supabase
    .from('reportes')
    .select('id')
    .eq('id', id)
    .single()
  if (!reporte) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })

  return NextResponse.json({ data: { id: reporte.id, token: tokenFirma(reporte.id) } })
}

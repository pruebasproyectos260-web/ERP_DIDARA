import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { registrarActividad } from '@/lib/actividad'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

  const { data: borrados, error } = await supabase.from('ingresos_manuales').delete().eq('id', id).select('descripcion, monto, fecha')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (borrados?.length) await registrarActividad(auth, 'eliminar', 'ingresos_manuales', id, `${borrados[0].descripcion} $${borrados[0].monto} (${borrados[0].fecha})`)
  return NextResponse.json({ ok: true })
}

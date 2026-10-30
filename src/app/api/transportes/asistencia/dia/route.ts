import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { esquemaMarcaDia } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

/** Decide a mano si la oficina trabajó un día (o lo regresa a lo automático) */
export async function PUT(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const parsed = esquemaMarcaDia.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { fecha, estado, nota } = parsed.data

  // Sin tocar "documentos": si el día ya se leyó de TALONES/REMI conserva su conteo (null = aún no se lee)
  const { data: previo } = await auth.supabase.from('tcg_dias').select('fecha').eq('fecha', fecha).maybeSingle()
  const { error } = previo
    ? await auth.supabase.from('tcg_dias').update({ estado, nota }).eq('fecha', fecha)
    : await auth.supabase.from('tcg_dias').insert({ fecha, estado, nota })
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

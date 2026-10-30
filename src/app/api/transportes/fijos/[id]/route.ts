import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson, soloEnviados } from '@/lib/campos'
import { esquemaCambioFijo } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await leerJson(req)
  const parsed = esquemaCambioFijo.safeParse(body)
  if (!parsed.success) return errorValidacion(parsed.error)
  const cambios: Record<string, unknown> = soloEnviados(parsed.data, body)

  const { data: actual } = await auth.supabase.from('tcg_fijos').select('ambito, desde, hasta').eq('id', id).single()
  if (!actual) return NextResponse.json({ error: 'Gasto fijo no encontrado' }, { status: 404 })
  const desde = (cambios.desde ?? actual.desde) as string
  const hasta = (cambios.hasta !== undefined ? cambios.hasta : actual.hasta) as string | null
  if (hasta && hasta < desde) return NextResponse.json({ error: 'El último mes no puede ser antes del primero' }, { status: 400 })
  if ((cambios.ambito ?? actual.ambito) === 'hogar') cambios.camion_id = null

  const { data, error } = await auth.supabase.from('tcg_fijos').update(cambios).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ data })
}

/** Borra el gasto fijo; los pagos ya registrados se quedan como gastos normales */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const { error } = await auth.supabase.from('tcg_fijos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { errorValidacion, leerJson, soloEnviados } from '@/lib/campos'
import { camposCambiados, registrarActividad } from '@/lib/actividad'
import { esquemaCambioRecurrente } from '@/lib/finanzas'
import { soloFinanzas } from '@/lib/finanzas-servidor'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado
  const { id } = await params

  const body = await leerJson(req)
  const parsed = esquemaCambioRecurrente.safeParse(body)
  if (!parsed.success) return errorValidacion(parsed.error)
  const cambios = soloEnviados(parsed.data, body)

  const { data: previo } = await auth.supabase.from('fin_recurrentes').select('desde, hasta, nombre').eq('id', id).single()
  if (!previo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const desde = cambios.desde ?? previo.desde
  const hasta = cambios.hasta !== undefined ? cambios.hasta : previo.hasta
  if (hasta && hasta < desde) return NextResponse.json({ error: 'El último mes no puede ser antes del primero' }, { status: 400 })

  const { data, error } = await auth.supabase.from('fin_recurrentes').update(cambios).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  await registrarActividad(auth, 'editar', 'fin_recurrentes', id, `${previo.nombre} — ${camposCambiados(cambios)}`)
  return NextResponse.json({ data })
}

/** Borra el pago/cobro fijo. Lo que ya se pagó en meses anteriores se conserva en movimientos. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado
  const { id } = await params

  const { data: borrados, error } = await auth.supabase.from('fin_recurrentes').delete().eq('id', id).select('nombre')
  if (error) return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 500 })
  if (borrados?.length) await registrarActividad(auth, 'eliminar', 'fin_recurrentes', id, borrados[0].nombre)
  return NextResponse.json({ ok: true })
}

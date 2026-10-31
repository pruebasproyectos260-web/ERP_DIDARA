import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson, soloEnviados } from '@/lib/campos'
import { esquemaCambioGastoTCG, type Ambito } from '@/lib/transportes'
import { SELECT_GASTO_TCG, soloSuperAdmin, vehiculoDelAmbito } from '@/lib/transportes-servidor'

type Supabase = Exclude<Awaited<ReturnType<typeof soloSuperAdmin>>, NextResponse>['supabase']

/** Los gastos que salieron de un trabajo de Camiones se cambian desde el trabajo */
async function gastoEditable(supabase: Supabase, id: string) {
  const { data: gasto } = await supabase.from('tcg_gastos').select('*, trabajo:tcg_trabajos(id)').eq('id', id).single()
  if (!gasto) return { error: NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 }) }
  const trabajo = Array.isArray(gasto.trabajo) ? gasto.trabajo[0] : gasto.trabajo
  if (trabajo) return { error: NextResponse.json({ error: 'Este gasto es de un trabajo de un camión: cámbialo desde Camiones' }, { status: 409 }) }
  return { gasto }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { gasto, error: rechazo } = await gastoEditable(auth.supabase, id)
  if (rechazo) return rechazo

  const body = await leerJson(req)
  const parsed = esquemaCambioGastoTCG.safeParse(body)
  if (!parsed.success) return errorValidacion(parsed.error)
  const cambios: Record<string, unknown> = soloEnviados(parsed.data, body)
  if ('camion_id' in cambios || 'ambito' in cambios) {
    cambios.camion_id = await vehiculoDelAmbito(auth.supabase, (cambios.camion_id ?? gasto.camion_id) as number | null, (cambios.ambito ?? gasto.ambito) as Ambito)
  }

  const monto = (cambios.monto as number | undefined) ?? Number(gasto.monto)
  const iva = cambios.iva !== undefined ? (cambios.iva as number | null) : gasto.iva
  if (iva != null && iva > monto) return NextResponse.json({ error: 'El IVA no puede ser mayor que el total' }, { status: 400 })

  const { data, error } = await auth.supabase.from('tcg_gastos')
    .update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).select(SELECT_GASTO_TCG).single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })

  // Fotos que se quitaron del gasto: ya no se necesitan
  const comprobantes = cambios.comprobantes as string[] | undefined
  const quitados = comprobantes ? (gasto.comprobantes as string[]).filter((r) => !comprobantes.includes(r)) : []
  if (quitados.length) await auth.supabase.storage.from('documentos').remove(quitados)
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { gasto, error: rechazo } = await gastoEditable(auth.supabase, id)
  if (rechazo) return rechazo

  const { error } = await auth.supabase.from('tcg_gastos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 500 })
  if (gasto.comprobantes?.length) await auth.supabase.storage.from('documentos').remove(gasto.comprobantes)
  return NextResponse.json({ ok: true })
}

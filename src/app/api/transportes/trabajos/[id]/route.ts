import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson, soloEnviados } from '@/lib/campos'
import { esquemaCambioTrabajo } from '@/lib/transportes'
import { SELECT_TRABAJO, sincronizarGastoTrabajo, soloSuperAdmin } from '@/lib/transportes-servidor'

const CAMPOS_PAGO = ['metodo_pago', 'con_factura', 'iva', 'comprobantes'] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { data: actual } = await auth.supabase.from('tcg_trabajos').select(SELECT_TRABAJO).eq('id', id).single()
  if (!actual) return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 })

  const body = await leerJson(req)
  const parsed = esquemaCambioTrabajo.safeParse(body)
  if (!parsed.success) return errorValidacion(parsed.error)
  const cambios: Record<string, unknown> = soloEnviados(parsed.data, body)
  const pago: Record<string, unknown> = {}
  for (const c of CAMPOS_PAGO) if (c in cambios) { pago[c] = cambios[c]; delete cambios[c] }

  const trabajo = { ...actual, ...cambios }
  const g = actual.gasto
  const datosPago = {
    metodo_pago: (pago.metodo_pago !== undefined ? pago.metodo_pago : g?.metodo_pago ?? null) as string | null,
    con_factura: (pago.con_factura ?? g?.con_factura ?? false) as boolean,
    iva: (pago.iva !== undefined ? pago.iva : g?.iva ?? null) as number | null,
    comprobantes: (pago.comprobantes ?? g?.comprobantes ?? []) as string[],
  }
  // Con costo 0 no hay gasto: el IVA anterior ya no aplica
  if (Number(trabajo.costo) > 0 && datosPago.iva != null && datosPago.iva > Number(trabajo.costo)) {
    return NextResponse.json({ error: 'El IVA no puede ser mayor que el costo' }, { status: 400 })
  }

  try {
    const gasto_id = await sincronizarGastoTrabajo(auth.supabase, {
      camion_id: trabajo.camion_id, fecha: trabajo.fecha, tipo: trabajo.tipo, descripcion: trabajo.descripcion,
      taller: trabajo.taller, costo: Number(trabajo.costo), gasto_id: actual.gasto_id,
    }, datosPago)
    const { data, error } = await auth.supabase.from('tcg_trabajos')
      .update({ ...cambios, gasto_id, updated_at: new Date().toISOString() }).eq('id', id).select(SELECT_TRABAJO).single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar el trabajo' }, { status: 500 })
  }
}

/** Borra el trabajo y su gasto (con sus fotos) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { data: trabajo } = await auth.supabase.from('tcg_trabajos').select('id, gasto_id').eq('id', id).single()
  if (!trabajo) return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 })
  const { error } = await auth.supabase.from('tcg_trabajos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 500 })
  if (trabajo.gasto_id) {
    const { data: g } = await auth.supabase.from('tcg_gastos').delete().eq('id', trabajo.gasto_id).select('comprobantes').single()
    if (g?.comprobantes?.length) await auth.supabase.storage.from('documentos').remove(g.comprobantes)
  }
  return NextResponse.json({ ok: true })
}

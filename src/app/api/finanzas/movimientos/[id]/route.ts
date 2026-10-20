import { NextRequest, NextResponse } from 'next/server'
import { requireNivel, type Sesion } from '@/lib/auth'
import { errorValidacion, leerJson, soloEnviados } from '@/lib/campos'
import { camposCambiados, registrarActividad } from '@/lib/actividad'
import { esquemaCambioMovimiento, formatoMoneda } from '@/lib/finanzas'
import { esFinanzas, SELECT_MOVIMIENTO } from '@/lib/finanzas-servidor'

/**
 * Administración/contabilidad: cualquier movimiento.
 * Equipo de campo: solo sus gastos que aún no se revisan.
 */
async function movimientoEditable(auth: Sesion, id: string) {
  const { data: mov } = await auth.supabase.from('movimientos').select('*').eq('id', id).single()
  if (!mov) return { error: NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 }) }
  if (!esFinanzas(auth)) {
    if (mov.registrado_por !== auth.userId) return { error: NextResponse.json({ error: 'No puedes modificar este movimiento' }, { status: 403 }) }
    if (mov.revisado) return { error: NextResponse.json({ error: 'Este gasto ya fue revisado; pide a administración que lo corrija' }, { status: 403 }) }
  }
  return { mov }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { mov, error: rechazo } = await movimientoEditable(auth, id)
  if (rechazo) return rechazo

  const body = await leerJson(req)
  const parsed = esquemaCambioMovimiento.safeParse(body)
  if (!parsed.success) return errorValidacion(parsed.error)
  const cambios: Record<string, unknown> = soloEnviados(parsed.data, body)
  const finanzas = esFinanzas(auth)

  if (!finanzas) {
    delete cambios.revisado
    delete cambios.cliente_id
    if (cambios.tipo && cambios.tipo !== 'gasto') return NextResponse.json({ error: 'Solo puedes registrar gastos' }, { status: 403 })
  }
  const comprobantes = cambios.comprobantes as string[] | undefined
  if (comprobantes?.some((r) => !mov.comprobantes.includes(r) && !r.startsWith(`comprobantes/${auth.userId}/`))) {
    return NextResponse.json({ error: 'Comprobante inválido' }, { status: 400 })
  }
  const monto = (cambios.monto as number | undefined) ?? Number(mov.monto)
  const iva = cambios.iva !== undefined ? (cambios.iva as number | null) : mov.iva
  if (iva != null && iva > monto) return NextResponse.json({ error: 'El IVA no puede ser mayor que el total' }, { status: 400 })

  if (cambios.revisado !== undefined) {
    cambios.revisado_por = cambios.revisado ? auth.nombre : null
    cambios.revisado_at = cambios.revisado ? new Date().toISOString() : null
  }

  const { data, error } = await auth.supabase.from('movimientos')
    .update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).select(SELECT_MOVIMIENTO).single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })

  // Fotos que se quitaron del gasto: ya no se necesitan
  const quitados = comprobantes ? (mov.comprobantes as string[]).filter((r) => !comprobantes.includes(r)) : []
  if (quitados.length) await auth.supabase.storage.from('documentos').remove(quitados)

  const soloRevision = Object.keys(cambios).every((k) => k.startsWith('revisado'))
  await registrarActividad(auth, soloRevision ? 'revisar' : 'editar', 'movimientos', id,
    soloRevision ? `${mov.categoria} ${formatoMoneda(Number(mov.monto))} de ${mov.registrado_nombre ?? '—'}` : camposCambiados(cambios))
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { mov, error: rechazo } = await movimientoEditable(auth, id)
  if (rechazo) return rechazo

  const { error } = await auth.supabase.from('movimientos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 500 })

  // Los comprobantes ya no sirven sin el movimiento
  if (mov.comprobantes?.length) await auth.supabase.storage.from('documentos').remove(mov.comprobantes)
  await registrarActividad(auth, 'eliminar', 'movimientos', id,
    `${mov.tipo === 'gasto' ? 'Gasto' : 'Ingreso'} ${mov.categoria} ${formatoMoneda(Number(mov.monto))} (${mov.fecha})`)
  return NextResponse.json({ ok: true })
}

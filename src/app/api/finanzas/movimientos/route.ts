import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { errorValidacion, leerJson, limpiarBusqueda } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'
import { esquemaMes, esquemaMovimiento, faltaMigracionFinanzas, formatoMoneda, rangoMes } from '@/lib/finanzas'
import { esFinanzas, SELECT_MOVIMIENTO } from '@/lib/finanzas-servidor'

// Administración y contabilidad ven todo; el resto del equipo solo sus propios gastos.

export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const sp = req.nextUrl.searchParams

  let consulta = auth.supabase.from('movimientos').select(SELECT_MOVIMIENTO)
    .order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1000)

  const mes = esquemaMes.safeParse(sp.get('mes'))
  if (mes.success) {
    const { desde, hasta } = rangoMes(mes.data)
    consulta = consulta.gte('fecha', desde).lte('fecha', hasta)
  }
  const tipo = sp.get('tipo')
  if (tipo === 'gasto' || tipo === 'ingreso') consulta = consulta.eq('tipo', tipo)
  if (sp.get('revisado') === 'false') consulta = consulta.eq('revisado', false)
  const q = limpiarBusqueda(sp.get('q') ?? '')
  if (q) consulta = consulta.or(`descripcion.ilike.%${q}%,proveedor.ilike.%${q}%,categoria.ilike.%${q}%,registrado_nombre.ilike.%${q}%`)

  if (!esFinanzas(auth)) consulta = consulta.eq('registrado_por', auth.userId).eq('tipo', 'gasto')

  const { data, error } = await consulta
  if (error) {
    if (faltaMigracionFinanzas(error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: 'No se pudieron cargar los movimientos' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth

  const parsed = esquemaMovimiento.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const datos = parsed.data
  const finanzas = esFinanzas(auth)

  // El equipo de campo solo registra gastos; administración/contabilidad los revisa después
  if (!finanzas && datos.tipo !== 'gasto') {
    return NextResponse.json({ error: 'Solo puedes registrar gastos' }, { status: 403 })
  }
  // Los comprobantes deben ser del propio usuario (se suben a su carpeta)
  if (datos.comprobantes.some((r) => !r.startsWith(`comprobantes/${auth.userId}/`))) {
    return NextResponse.json({ error: 'Comprobante inválido' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.from('movimientos').insert({
    ...datos,
    cliente_id: finanzas ? datos.cliente_id : null,
    registrado_por: auth.userId,
    registrado_nombre: auth.nombre,
    revisado: finanzas,
    revisado_por: finanzas ? auth.nombre : null,
    revisado_at: finanzas ? new Date().toISOString() : null,
  }).select(SELECT_MOVIMIENTO).single()

  if (error) {
    if (faltaMigracionFinanzas(error)) return NextResponse.json({ error: 'Falta activar Finanzas en Supabase (supabase/migracion_finanzas.sql)' }, { status: 503 })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  await registrarActividad(auth, 'crear', 'movimientos', data.id,
    `${datos.tipo === 'gasto' ? 'Gasto' : 'Ingreso'} ${datos.categoria} ${formatoMoneda(datos.monto)}`)
  return NextResponse.json({ data }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { esLaborable, esquemaMarcaAsistencia, faltaMigracionTCG } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

/**
 * Todo lo necesario para calcular la asistencia de un año (el cálculo se hace en el navegador
 * con resumenAnio): empleados, lo leído de TALONES/REMI, el movimiento de la oficina por día y las marcas a mano.
 */
export async function GET(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const anio = Number(req.nextUrl.searchParams.get('anio')) || new Date().getFullYear()
  const desde = `${anio}-01-01`, hasta = `${anio}-12-31`

  const [empleados, actividad, dias, marcas, ultima] = await Promise.all([
    auth.supabase.from('tcg_empleados').select('*').order('activo', { ascending: false }).order('nombre'),
    auth.supabase.from('tcg_actividad').select('fecha, usuario, documentos, fuentes').gte('fecha', desde).lte('fecha', hasta).limit(10000),
    auth.supabase.from('tcg_dias').select('fecha, documentos, estado, nota').gte('fecha', desde).lte('fecha', hasta).limit(1000),
    auth.supabase.from('tcg_asistencia').select('empleado_id, fecha, estado, nota').gte('fecha', desde).lte('fecha', hasta).limit(10000),
    auth.supabase.from('tcg_dias').select('fecha, actualizado_at').not('documentos', 'is', null)
      .order('actualizado_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const error = empleados.error ?? actividad.error ?? dias.error ?? marcas.error
  if (error) {
    if (faltaMigracionTCG(error)) return NextResponse.json({ data: null, pendiente: true })
    return NextResponse.json({ error: 'No se pudo cargar la asistencia' }, { status: 500 })
  }
  // Usuarios que aparecen en TALONES/REMI (para ligarlos con un empleado)
  const usuarios = [...new Set((actividad.data ?? []).map((a) => a.usuario))].sort()
  return NextResponse.json({
    data: {
      empleados: empleados.data, actividad: actividad.data, dias: dias.data, marcas: marcas.data,
      usuarios, ultimaLectura: ultima.data?.actualizado_at ?? null,
    },
  })
}

/**
 * Marca (o quita la marca de) un día de un empleado, o un rango de días (`hasta`): vacaciones,
 * descansos… En un rango se marcan solo los días de lunes a sábado que no son festivos.
 */
export async function PUT(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const parsed = esquemaMarcaAsistencia.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { empleado_id, fecha, hasta, estado, nota } = parsed.data

  const fechas: string[] = []
  for (let d = new Date(`${fecha}T12:00:00Z`); d.toISOString().slice(0, 10) <= (hasta ?? fecha); d.setUTCDate(d.getUTCDate() + 1)) {
    const f = d.toISOString().slice(0, 10)
    if (!hasta || esLaborable(f)) fechas.push(f)
  }
  if (!fechas.length) return NextResponse.json({ error: 'En ese rango no hay días hábiles' }, { status: 400 })

  const { error } = estado
    ? await auth.supabase.from('tcg_asistencia').upsert(fechas.map((f) => ({ empleado_id, fecha: f, estado, nota })), { onConflict: 'empleado_id,fecha' })
    : await auth.supabase.from('tcg_asistencia').delete().eq('empleado_id', empleado_id).in('fecha', fechas)
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true, dias: fechas.length })
}

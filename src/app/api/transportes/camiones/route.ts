import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { hoyMexico, redondear } from '@/lib/finanzas'
import { DOCUMENTOS_INICIALES, ETIQUETA_DOCUMENTO, esquemaCamion, estadoVencimiento, faltaMigracionTCG, USOS, type Camion } from '@/lib/transportes'
import { datosVehiculos, soloSuperAdmin } from '@/lib/transportes-servidor'

// Falta la migración de vehículos (columna uso / tablas nuevas)
const faltaMigracion = (e: { code?: string } | null) => faltaMigracionTCG(e) || e?.code === '42703'

/** Vehículos (camiones o carros) con sus trabajos, lo gastado, kilometraje, aceite y documentos por vencer */
export async function GET(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const uso = USOS.find((u) => u === req.nextUrl.searchParams.get('uso'))

  let consulta = auth.supabase.from('tcg_camiones').select('*').order('activo', { ascending: false }).order('nombre')
  if (uso) consulta = consulta.eq('uso', uso)
  const [camiones, trabajos, docs] = await Promise.all([
    consulta,
    auth.supabase.from('tcg_trabajos').select('camion_id, costo, fecha'),
    auth.supabase.from('tcg_documentos').select('camion_id, vence'),
  ])
  if (camiones.error || docs.error) {
    if (faltaMigracion(camiones.error ?? docs.error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: 'No se pudieron cargar los vehículos' }, { status: 500 })
  }
  const hoy = hoyMexico()
  const datos = await datosVehiculos(auth.supabase, camiones.data as Camion[], hoy)
  const data = camiones.data.map((c) => {
    const suyos = (trabajos.data ?? []).filter((t) => t.camion_id === c.id)
    const estados = (docs.data ?? []).filter((d) => d.camion_id === c.id).map((d) => estadoVencimiento(d.vence, hoy))
    const d = datos.get(c.id)
    return {
      ...c,
      trabajos: suyos.length,
      gastado: redondear(suyos.reduce((a, t) => a + Number(t.costo), 0)),
      ultimo_trabajo: suyos.reduce<string | null>((a, t) => (!a || t.fecha > a ? t.fecha : a), null),
      kilometraje: d?.kmActual ?? null,
      kilometraje_fecha: d?.kmFecha ?? null,
      aceite: d?.aceite ?? null,
      docs_vencidos: estados.filter((e) => e === 'vencido').length,
      docs_proximos: estados.filter((e) => e === 'este_mes' || e === 'pronto').length,
    }
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const parsed = esquemaCamion.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { data, error } = await auth.supabase.from('tcg_camiones').insert(parsed.data).select('*').single()
  if (error) {
    if (faltaMigracion(error)) return NextResponse.json({ error: 'Falta activar los vehículos en Supabase (supabase/migracion_transportes_vehiculos.sql)' }, { status: 503 })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  // Documentos de siempre, vacíos, para llenarles fecha y archivo
  await auth.supabase.from('tcg_documentos').insert(DOCUMENTOS_INICIALES[parsed.data.uso].map((d) => ({
    camion_id: data.id, tipo: d.tipo, nombre: ETIQUETA_DOCUMENTO[d.tipo], cada_meses: d.cada_meses,
  })))
  return NextResponse.json({ data: { ...data, trabajos: 0, gastado: 0, ultimo_trabajo: null, kilometraje: null } }, { status: 201 })
}

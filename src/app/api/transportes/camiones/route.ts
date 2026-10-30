import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { redondear } from '@/lib/finanzas'
import { esquemaCamion, faltaMigracionTCG } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

/** Camiones con cuántos trabajos llevan, lo que han costado y el último trabajo */
export async function GET() {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const [camiones, trabajos] = await Promise.all([
    auth.supabase.from('tcg_camiones').select('*').order('activo', { ascending: false }).order('nombre'),
    auth.supabase.from('tcg_trabajos').select('camion_id, costo, fecha, kilometraje'),
  ])
  if (camiones.error) {
    if (faltaMigracionTCG(camiones.error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: 'No se pudieron cargar los camiones' }, { status: 500 })
  }
  const data = camiones.data.map((c) => {
    const suyos = (trabajos.data ?? []).filter((t) => t.camion_id === c.id)
    return {
      ...c,
      trabajos: suyos.length,
      gastado: redondear(suyos.reduce((a, t) => a + Number(t.costo), 0)),
      ultimo_trabajo: suyos.reduce<string | null>((a, t) => (!a || t.fecha > a ? t.fecha : a), null),
      kilometraje: suyos.reduce<number | null>((a, t) => (t.kilometraje != null && (a == null || t.kilometraje > a) ? t.kilometraje : a), null),
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
    if (faltaMigracionTCG(error)) return NextResponse.json({ error: 'Falta activar Transportes en Supabase (supabase/migracion_transportes.sql)' }, { status: 503 })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ data: { ...data, trabajos: 0, gastado: 0, ultimo_trabajo: null, kilometraje: null } }, { status: 201 })
}

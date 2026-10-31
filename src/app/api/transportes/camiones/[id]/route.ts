import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson, soloEnviados } from '@/lib/campos'
import { esquemaCambioCamion } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await leerJson(req)
  const parsed = esquemaCambioCamion.safeParse(body)
  if (!parsed.success) return errorValidacion(parsed.error)

  const { data, error } = await auth.supabase.from('tcg_camiones').update(soloEnviados(parsed.data, body)).eq('id', id).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo guardar' }, { status: error ? 500 : 404 })
  return NextResponse.json({ data })
}

/**
 * Solo se borra un vehículo sin trabajos; si ya tiene historial, se da de baja (activo = false).
 * Se van con él sus documentos (y sus archivos) y lecturas de kilometraje.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { count } = await auth.supabase.from('tcg_trabajos').select('id', { count: 'exact', head: true }).eq('camion_id', id)
  if (count) return NextResponse.json({ error: 'Este vehículo tiene trabajos registrados: mejor dalo de baja para conservar su historial' }, { status: 409 })
  const { data: docs } = await auth.supabase.from('tcg_documentos').select('archivos').eq('camion_id', id)
  const { error } = await auth.supabase.from('tcg_camiones').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 500 })
  const archivos = (docs ?? []).flatMap((d) => d.archivos ?? [])
  if (archivos.length) await auth.supabase.storage.from('documentos').remove(archivos)
  return NextResponse.json({ ok: true })
}

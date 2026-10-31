import { NextRequest, NextResponse } from 'next/server'
import { errorValidacion, leerJson, soloEnviados } from '@/lib/campos'
import { esquemaCambioDocumento } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { data: actual } = await auth.supabase.from('tcg_documentos').select('archivos').eq('id', id).single()
  if (!actual) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const body = await leerJson(req)
  const parsed = esquemaCambioDocumento.safeParse(body)
  if (!parsed.success) return errorValidacion(parsed.error)
  const cambios: Record<string, unknown> = soloEnviados(parsed.data, body)
  delete cambios.camion_id // un documento no se cambia de vehículo

  const { data, error } = await auth.supabase.from('tcg_documentos')
    .update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })

  // Archivos que se quitaron del documento: ya no se necesitan
  const archivos = cambios.archivos as string[] | undefined
  const quitados = archivos ? (actual.archivos as string[]).filter((r) => !archivos.includes(r)) : []
  if (quitados.length) await auth.supabase.storage.from('documentos').remove(quitados)
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const { data, error } = await auth.supabase.from('tcg_documentos').delete().eq('id', id).select('archivos').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo eliminar' }, { status: error ? 500 : 404 })
  if (data.archivos?.length) await auth.supabase.storage.from('documentos').remove(data.archivos)
  return NextResponse.json({ ok: true })
}

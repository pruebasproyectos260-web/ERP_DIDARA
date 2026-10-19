import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, pick, pickItems } from '@/lib/campos'
import { reemplazarPartidas } from '@/lib/partidas'
import { registrarActividad } from '@/lib/actividad'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

  const { data, error } = await supabase
    .from('reportes')
    .select('*, cliente:clientes(*), items:reporte_items(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params
  const body = await leerJson(req)
  const reporteData = pick(body, CAMPOS.reportes)
  const items = pickItems(body.items, CAMPOS.reporte_items)

  const { error } = await supabase
    .from('reportes')
    .update(reporteData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (items !== undefined) {
    const errorPartidas = await reemplazarPartidas(supabase, 'reporte_items', 'reporte_id', id, items)
    if (errorPartidas) return NextResponse.json({ error: errorPartidas }, { status: 500 })
  }

  const { data: completo } = await supabase
    .from('reportes')
    .select('*, cliente:clientes(id, nombre), items:reporte_items(*)')
    .eq('id', id)
    .single()

  if (completo) await registrarActividad(auth, 'editar', 'reportes', id, `${completo.folio} (estado: ${completo.estado})`)

  return NextResponse.json({ data: completo })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

  // Obtener evidencias antes de borrar para limpiar Storage
  const { data: reporte } = await supabase
    .from('reportes')
    .select('evidencias, folio')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('reportes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (reporte) await registrarActividad(auth, 'eliminar', 'reportes', id, reporte.folio)

  // Borrar imágenes de Storage
  if (reporte?.evidencias) {
    const evidencias = reporte.evidencias as { urls?: string[] }[]
    const paths = evidencias
      .flatMap((ev) => ev.urls ?? [])
      .map((url: string) => {
        const marker = '/storage/v1/object/public/evidencias/'
        const idx = url.indexOf(marker)
        return idx >= 0 ? url.slice(idx + marker.length) : null
      })
      .filter(Boolean) as string[]

    if (paths.length > 0) {
      await supabase.storage.from('evidencias').remove(paths)
    }
  }

  return NextResponse.json({ ok: true })
}

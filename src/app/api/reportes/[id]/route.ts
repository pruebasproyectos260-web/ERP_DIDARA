import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

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
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()
  const { items, ...reporteData } = body

  const { error } = await supabase
    .from('reportes')
    .update(reporteData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (items !== undefined) {
    await supabase.from('reporte_items').delete().eq('reporte_id', id)
    if (items.length > 0) {
      await supabase.from('reporte_items').insert(
        items.map((item: Record<string, unknown>) => ({ ...item, reporte_id: id }))
      )
    }
  }

  const { data: completo } = await supabase
    .from('reportes')
    .select('*, cliente:clientes(id, nombre), items:reporte_items(*)')
    .eq('id', id)
    .single()

  return NextResponse.json({ data: completo })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const serviceSupabase = createServiceClient()

  // Obtener evidencias antes de borrar para limpiar Storage
  const { data: reporte } = await supabase
    .from('reportes')
    .select('evidencias')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('reportes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Borrar imágenes de Storage con service client (bypasea RLS)
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
      await serviceSupabase.storage.from('evidencias').remove(paths)
    }
  }

  return NextResponse.json({ ok: true })
}

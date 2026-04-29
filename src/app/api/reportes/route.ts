import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado') ?? ''
  const clienteId = searchParams.get('cliente_id') ?? ''

  let query = supabase
    .from('reportes')
    .select(`
      *,
      cliente:clientes(id, nombre),
      items:reporte_items(*)
    `)
    .order('created_at', { ascending: false })

  if (estado) query = query.eq('estado', estado)
  if (clienteId) query = query.eq('cliente_id', clienteId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { items, ...reporteData } = body

  const { data: folioData } = await supabase.rpc('generar_folio', {
    prefijo: 'RST',
    tabla: 'reportes',
  })

  const { data: reporte, error } = await supabase
    .from('reportes')
    .insert({ ...reporteData, folio: folioData })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (items?.length > 0) {
    await supabase.from('reporte_items').insert(
      items.map((item: Record<string, unknown>) => ({ ...item, reporte_id: reporte.id }))
    )
  }

  const { data: completo } = await supabase
    .from('reportes')
    .select('*, cliente:clientes(id, nombre), items:reporte_items(*)')
    .eq('id', reporte.id)
    .single()

  return NextResponse.json({ data: completo }, { status: 201 })
}

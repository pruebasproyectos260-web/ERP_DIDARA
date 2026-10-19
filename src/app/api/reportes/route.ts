import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, pick, pickItems } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
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
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const body = await leerJson(req)
  const reporteData = pick(body, CAMPOS.reportes)
  const items = pickItems(body.items, CAMPOS.reporte_items)

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

  if (items && items.length > 0) {
    const { error: itemsError } = await supabase.from('reporte_items').insert(
      items.map((item) => ({ ...item, reporte_id: reporte.id }))
    )
    if (itemsError) return NextResponse.json({ error: `El reporte ${reporte.folio} se creó pero sus partidas no: ${itemsError.message}` }, { status: 500 })
  }

  await registrarActividad(auth, 'crear', 'reportes', reporte.id, reporte.folio)

  const { data: completo } = await supabase
    .from('reportes')
    .select('*, cliente:clientes(id, nombre), items:reporte_items(*)')
    .eq('id', reporte.id)
    .single()

  return NextResponse.json({ data: completo }, { status: 201 })
}

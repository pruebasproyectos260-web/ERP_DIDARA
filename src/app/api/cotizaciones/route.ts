import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, ocultarCostosCotizacion, pick, pickItems } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase, nivel } = auth
  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado') ?? ''
  const clienteId = searchParams.get('cliente_id') ?? ''

  let query = supabase
    .from('cotizaciones')
    .select(`
      *,
      cliente:clientes(id, nombre),
      cotizacion_items(*)
    `)
    .order('created_at', { ascending: false })

  if (estado) query = query.eq('estado', estado)
  if (clienteId) query = query.eq('cliente_id', clienteId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    data: nivel >= NIVEL.RESTRINGIDO ? (data ?? []).map(ocultarCostosCotizacion) : data,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const body = await leerJson(req)
  const cotizacionData = pick(body, CAMPOS.cotizaciones)
  const items = pickItems(body.items, CAMPOS.cotizacion_items)

  // Generar folio
  const { data: folioData } = await supabase.rpc('generar_folio', {
    prefijo: 'COT',
    tabla: 'cotizaciones',
  })

  const { data: cotizacion, error } = await supabase
    .from('cotizaciones')
    .insert({
      ...cotizacionData,
      folio: folioData,
      created_by: auth.userId,
      elaborado_por: auth.nombre ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insertar items
  if (items && items.length > 0) {
    const { error: itemsError } = await supabase
      .from('cotizacion_items')
      .insert(items.map((item) => ({ ...item, cotizacion_id: cotizacion.id })))

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  await registrarActividad(auth, 'crear', 'cotizaciones', cotizacion.id, cotizacion.folio)

  // Retornar cotización completa
  const { data: completa } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(id, nombre), items:cotizacion_items(*)')
    .eq('id', cotizacion.id)
    .single()

  return NextResponse.json({ data: completa }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
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
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const supabase = createServiceClient()
  const body = await req.json()
  const { items, ...cotizacionData } = body

  // Generar folio
  const { data: folioData } = await supabase.rpc('generar_folio', {
    prefijo: 'COT',
    tabla: 'cotizaciones',
  })

  // Obtener usuario actual
  const { data: { user } } = await authClient.auth.getUser()

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nombre')
    .eq('id', user!.id)
    .single()

  const { data: cotizacion, error } = await supabase
    .from('cotizaciones')
    .insert({
      ...cotizacionData,
      folio: folioData,
      created_by: user!.id,
      elaborado_por: perfil?.nombre ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insertar items
  if (items?.length > 0) {
    const { error: itemsError } = await supabase
      .from('cotizacion_items')
      .insert(items.map((item: Record<string, unknown>) => ({ ...item, cotizacion_id: cotizacion.id })))

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Retornar cotización completa
  const { data: completa } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(id, nombre), cotizacion_items(*)')
    .eq('id', cotizacion.id)
    .single()

  return NextResponse.json({ data: completa }, { status: 201 })
}

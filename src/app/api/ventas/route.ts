import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde') ?? ''
  const hasta = searchParams.get('hasta') ?? ''

  let query = supabase
    .from('ventas')
    .select('*, cliente:clientes(id, nombre)')
    .order('fecha', { ascending: false })

  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const supabase = createServiceClient()
  const body = await req.json()
  const { data: { user } } = await authClient.auth.getUser()

  const { data, error } = await supabase
    .from('ventas')
    .insert({ ...body, created_by: user!.id })
    .select('*, cliente:clientes(id, nombre)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

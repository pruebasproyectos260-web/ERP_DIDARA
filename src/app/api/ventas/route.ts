import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, pick } from '@/lib/campos'

// Endpoint legado: ninguna pantalla lo usa hoy (Ventas lee cotizaciones, reportes e ingresos).

export async function GET(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
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
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const body = pick(await leerJson(req), CAMPOS.ventas)

  const { data, error } = await supabase
    .from('ventas')
    .insert({ ...body, created_by: auth.userId })
    .select('*, cliente:clientes(id, nombre)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

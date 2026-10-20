import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { CAMPOS, leerJson, pick } from '@/lib/campos'
import { puedeVerEvento } from '@/lib/agenda'

export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde') ?? ''
  const hasta = searchParams.get('hasta') ?? ''

  let query = supabase
    .from('eventos')
    .select('*, cliente:clientes(id, nombre)')
    .order('fecha_inicio')

  if (desde) query = query.gte('fecha_inicio', desde)
  if (hasta) query = query.lte('fecha_inicio', hasta)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Cada quien ve solo los eventos donde es encargado (niveles 0 y 1 ven todos)
  return NextResponse.json({ data: (data ?? []).filter((ev) => puedeVerEvento(ev, auth)) })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const body = pick(await leerJson(req), CAMPOS.eventos)

  // responsable_id = quien creó el evento (los encargados van en "responsables")
  const { data, error } = await supabase
    .from('eventos')
    .insert({ ...body, responsable_id: auth.userId })
    .select('*, cliente:clientes(id, nombre)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

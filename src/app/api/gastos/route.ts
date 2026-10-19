import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, pick } from '@/lib/campos'

// Endpoint legado: Gastos usa /api/gastos-fijos y /api/gastos-variables.

export async function GET(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') ?? ''

  let query = supabase
    .from('gastos')
    .select('*')
    .order('fecha', { ascending: false })

  if (tipo) query = query.eq('tipo', tipo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const body = pick(await leerJson(req), CAMPOS.gastos)

  const { data, error } = await supabase
    .from('gastos')
    .insert({ ...body, created_by: auth.userId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
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
  const supabase = await createClient()
  const body = await req.json()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('gastos')
    .insert({ ...body, created_by: user!.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

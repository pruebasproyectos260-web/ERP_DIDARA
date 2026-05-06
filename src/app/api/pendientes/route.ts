import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()

  // Auto-eliminar completados con más de 2 días
  const hace2Dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('pendientes')
    .delete()
    .eq('estado', 'Completado')
    .lt('updated_at', hace2Dias)

  const { data, error } = await supabase
    .from('pendientes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('pendientes')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

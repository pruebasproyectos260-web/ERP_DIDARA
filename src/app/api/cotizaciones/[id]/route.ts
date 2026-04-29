import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(*), cotizacion_items(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()
  const { items, ...cotizacionData } = body

  const { error } = await supabase
    .from('cotizaciones')
    .update(cotizacionData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reemplazar items si se envían
  if (items !== undefined) {
    await supabase.from('cotizacion_items').delete().eq('cotizacion_id', id)
    if (items.length > 0) {
      await supabase.from('cotizacion_items').insert(
        items.map((item: Record<string, unknown>) => ({ ...item, cotizacion_id: id }))
      )
    }
  }

  const { data: completa } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(id, nombre), cotizacion_items(*)')
    .eq('id', id)
    .single()

  return NextResponse.json({ data: completa })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('cotizaciones').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

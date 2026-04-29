import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServiceClient()
  const { nombre, nivel, es_contador, correo, nueva_contrasena } = await req.json()

  const updateData: Record<string, unknown> = {}
  if (nombre !== undefined) updateData.nombre = nombre
  if (nivel !== undefined) updateData.nivel = nivel
  if (es_contador !== undefined) updateData.es_contador = es_contador
  if (correo !== undefined) updateData.correo = correo || null

  const { data, error } = await supabase
    .from('usuarios')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (nueva_contrasena) {
    const { error: authError } = await supabase.auth.admin.updateUserById(id, {
      password: nueva_contrasena,
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('usuarios')
    .update({ activo: false })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: authError } = await supabase.auth.admin.updateUserById(id, {
    ban_duration: '876600h',
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  return NextResponse.json({ data })
}

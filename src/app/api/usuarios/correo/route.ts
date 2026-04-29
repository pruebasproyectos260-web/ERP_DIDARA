import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre, correo, nivel')
    .eq('activo', true)
    .not('correo', 'is', null)
    .neq('correo', '')
    .lte('nivel', 2)
    .order('nombre')

  return NextResponse.json({ data: data ?? [] })
}

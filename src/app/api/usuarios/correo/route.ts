import { NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'

export async function GET() {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth

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

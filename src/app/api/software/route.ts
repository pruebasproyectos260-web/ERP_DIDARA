import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, pick } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function GET() {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth

  const { data, error } = await supabase
    .from('software')
    .select('*')
    .order('nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const body = pick(await leerJson(req), CAMPOS.software)

  const { data, error } = await supabase
    .from('software')
    .insert(body)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'crear', 'software', data.id, data.nombre)
  return NextResponse.json({ data }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, limpiarBusqueda, pick } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { searchParams } = new URL(req.url)
  const q = limpiarBusqueda(searchParams.get('q') ?? '')

  let query = supabase
    .from('clientes')
    .select('*')
    .eq('activo', true)
    .order('nombre')

  if (q) {
    query = query.or(`nombre.ilike.%${q}%,rfc.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const body = pick(await leerJson(req), CAMPOS.clientes)

  const { data, error } = await supabase
    .from('clientes')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'crear', 'clientes', data.id, data.nombre)
  return NextResponse.json({ data }, { status: 201 })
}

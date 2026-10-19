import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, pick } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function GET(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')   // '1'-'12'
  const anio = searchParams.get('anio') // '2026'

  let query = supabase.from('gastos_variables').select('*').order('fecha', { ascending: false })

  if (mes && anio) {
    const m = mes.padStart(2, '0')
    const desde = `${anio}-${m}-01`
    const hasta = `${anio}-${m}-31`
    query = query.gte('fecha', desde).lte('fecha', hasta)
  } else if (anio) {
    query = query.gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const body = pick(await leerJson(req), CAMPOS.gastos_variables)

  // Quién registró el gasto lo define la sesión, no el navegador
  const { data, error } = await supabase
    .from('gastos_variables')
    .insert({ ...body, registrado_por: auth.nombre || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'crear', 'gastos_variables', data.id, `${data.tipo} $${data.monto} (${data.fecha})`)
  return NextResponse.json({ data }, { status: 201 })
}

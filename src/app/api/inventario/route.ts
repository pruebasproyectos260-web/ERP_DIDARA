import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, limpiarBusqueda, ocultarCostosProducto, pick } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'

export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase, nivel } = auth
  const { searchParams } = new URL(req.url)
  const q = limpiarBusqueda(searchParams.get('q') ?? '')
  const categoria = searchParams.get('categoria') ?? ''

  let query = supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('nombre')

  if (q) {
    query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%,descripcion.ilike.%${q}%`)
  }
  if (categoria) {
    query = query.eq('categoria', categoria)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    data: nivel >= NIVEL.RESTRINGIDO ? (data ?? []).map(ocultarCostosProducto) : data,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const body = pick(await leerJson(req), CAMPOS.productos)

  // Auto-generar código PROD-XXXX
  const { data: ultimo } = await supabase
    .from('productos')
    .select('codigo')
    .like('codigo', 'PROD-%')
    .order('codigo', { ascending: false })
    .limit(1)
    .single()

  let codigo = 'PROD-0001'
  if (ultimo?.codigo) {
    const num = parseInt((ultimo.codigo as string).replace('PROD-', ''), 10)
    if (!isNaN(num)) codigo = `PROD-${String(num + 1).padStart(4, '0')}`
  }

  const { data, error } = await supabase
    .from('productos')
    .insert({ ...body, codigo })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'crear', 'productos', data.id, `${data.codigo} ${data.nombre}`)
  return NextResponse.json({ data }, { status: 201 })
}

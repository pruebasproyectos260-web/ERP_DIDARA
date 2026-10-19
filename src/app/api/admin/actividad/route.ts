import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'

export async function GET(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(req.url)
  const tabla = searchParams.get('tabla') ?? ''
  const limite = Math.min(Math.max(parseInt(searchParams.get('limite') ?? '300') || 300, 1), 1000)

  let query = auth.supabase
    .from('actividad')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite)
  if (tabla) query = query.eq('tabla', tabla)

  const { data, error } = await query
  if (error) {
    // La tabla aún no se crea: correr supabase/migracion_actividad.sql
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return NextResponse.json({ data: [], pendiente: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data, pendiente: false })
}

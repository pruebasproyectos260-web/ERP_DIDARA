import { NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'

export async function GET() {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth

  // Siempre los eventos del usuario en sesión (se ignora ?userId= para no consultar agendas ajenas)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const desde = hoy.toISOString().slice(0, 10)

  const hasta = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000)
  const hastaStr = hasta.toISOString().slice(0, 10) + 'T23:59:59'

  const { data, error } = await supabase
    .from('eventos')
    .select('id, titulo, tipo, fecha_inicio, estado')
    .eq('responsable_id', auth.userId)
    .gte('fecha_inicio', desde)
    .lte('fecha_inicio', hastaStr)
    .not('estado', 'in', '("Completado","Cancelado")')
    .order('fecha_inicio')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

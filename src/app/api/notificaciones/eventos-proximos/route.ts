import { NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { ahoraMexico, diaISO, esEncargado } from '@/lib/agenda'

/**
 * Eventos de los próximos 7 días donde el usuario en sesión es ENCARGADO.
 * Aplica a todos los niveles: los niveles 0 y 1 ven todos los eventos en la agenda,
 * pero solo se les avisa de los que tienen a su cargo.
 */
export async function GET() {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth

  // Las horas de la agenda son "de pared" (hora de México, ver lib/agenda.ts)
  const ahora = ahoraMexico()
  const desde = ahora.slice(0, 10)
  const [a, m, d] = desde.split('-').map(Number)
  const hastaStr = `${diaISO(new Date(a, m - 1, d + 7))}T23:59:59`

  const { data, error } = await supabase
    .from('eventos')
    .select('id, titulo, tipo, fecha_inicio, estado, responsables')
    .gte('fecha_inicio', desde)
    .lte('fecha_inicio', hastaStr)
    .not('estado', 'in', '("Completado","Cancelado")')
    .order('fecha_inicio')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    data: (data ?? []).filter((ev) => esEncargado(ev.responsables, auth.nombre))
      .map(({ id, titulo, tipo, fecha_inicio, estado }) => ({ id, titulo, tipo, fecha_inicio, estado })),
  })
}

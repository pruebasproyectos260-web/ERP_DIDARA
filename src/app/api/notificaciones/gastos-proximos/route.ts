import { NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { hoyMexico, sumarMeses } from '@/lib/finanzas'
import { fijosDelMes } from '@/lib/finanzas-servidor'

/** Pagos fijos sin marcar que vencen en los próximos 5 días o ya vencieron este mes */
export async function GET() {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth

  const hoy = hoyMexico()
  const mes = hoy.slice(0, 7)
  const [este, siguiente] = await Promise.all([
    fijosDelMes(auth.supabase, mes),
    fijosDelMes(auth.supabase, sumarMeses(mes, 1)),
  ])
  if (este.error || siguiente.error) return NextResponse.json({ data: [] })

  const dias = (f: string) => Math.round((new Date(`${f}T12:00:00`).getTime() - new Date(`${hoy}T12:00:00`).getTime()) / 86_400_000)
  const proximos = [...este.data, ...siguiente.data]
    .filter((f) => f.tipo === 'gasto' && f.vigente && !f.hecho && f.dia != null)
    .map((f) => ({ id: f.id, nombre: f.nombre, monto: Number(f.monto), dia: f.dia, fechaVencimiento: f.vence, diasRestantes: dias(f.vence) }))
    .filter((g) => g.diasRestantes <= 5 && (g.diasRestantes >= 0 || g.fechaVencimiento.startsWith(mes)))
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  return NextResponse.json({ data: proximos })
}

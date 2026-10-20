import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { esquemaMes, faltaMigracionFinanzas, hoyMexico } from '@/lib/finanzas'
import { resumenMes, soloFinanzas } from '@/lib/finanzas-servidor'

export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado

  const mes = esquemaMes.safeParse(req.nextUrl.searchParams.get('mes'))
  const { data, error } = await resumenMes(auth.supabase, mes.success ? mes.data : hoyMexico().slice(0, 7))
  if (error) {
    if (faltaMigracionFinanzas(error)) return NextResponse.json({ data: null, pendiente: true })
    return NextResponse.json({ error: 'No se pudo calcular el resumen' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

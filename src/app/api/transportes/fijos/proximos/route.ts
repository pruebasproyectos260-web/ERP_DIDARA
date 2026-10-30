import { NextResponse } from 'next/server'
import { hoyMexico } from '@/lib/finanzas'
import { fijosPorPagar, soloSuperAdmin } from '@/lib/transportes-servidor'

/** Gastos fijos de Transportes vencidos o por vencer (5 días): para la ventana de aviso al entrar */
export async function GET() {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  return NextResponse.json({ data: await fijosPorPagar(auth.supabase, hoyMexico()) })
}

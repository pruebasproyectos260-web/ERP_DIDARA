import { NextResponse } from 'next/server'
import { hoyMexico } from '@/lib/finanzas'
import { fijosPorPagar, pendientesVehiculos, soloSuperAdmin } from '@/lib/transportes-servidor'

/**
 * Para la ventana de aviso al entrar a Transportes: gastos fijos vencidos o por vencer, y de los
 * vehículos los documentos vencidos o por vencer y los cambios de aceite próximos.
 */
export async function GET() {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const hoy = hoyMexico()
  const [fijos, vehiculos] = await Promise.all([fijosPorPagar(auth.supabase, hoy), pendientesVehiculos(auth.supabase, hoy)])
  return NextResponse.json({ data: { fijos, vehiculos } })
}

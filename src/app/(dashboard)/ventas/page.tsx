import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VentasClient from './VentasClient'

export const dynamic = 'force-dynamic'

export default async function VentasPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  const { data: perfil } = await authClient
    .from('usuarios')
    .select('nivel, nombre')
    .eq('id', user!.id)
    .single()

  if (perfil?.nivel === 3) redirect('/clientes')

  const supabase = createServiceClient()

  const [
    { data: cotizaciones },
    { data: reportes },
    { data: ingresosManuales },
    { data: gananciasFijas },
  ] = await Promise.all([
    supabase.from('cotizaciones')
      .select('id, folio, fecha, estado, total, ganancia_total, ganancia_real, pct_didara, cliente:clientes(id,nombre)')
      .in('estado', ['pagada', 'facturada'])
      .order('fecha', { ascending: false }),
    supabase.from('reportes')
      .select('id, folio, fecha_ingreso, total, cliente:clientes(id,nombre), tipo_servicio')
      .gt('total', 0)
      .order('fecha_ingreso', { ascending: false }),
    supabase.from('ingresos_manuales').select('*').order('fecha', { ascending: false }),
    supabase.from('ganancias_fijas').select('*').order('created_at', { ascending: false }),
  ])

  return (
    <VentasClient
      cotizaciones={(cotizaciones ?? []) as never}
      reportes={(reportes ?? []) as never}
      ingresosManuales={ingresosManuales ?? []}
      gananciasFijas={gananciasFijas ?? []}
      nivel={perfil?.nivel ?? 2}
    />
  )
}

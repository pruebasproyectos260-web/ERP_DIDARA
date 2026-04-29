import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nivel, nombre')
    .eq('id', user!.id)
    .single()

  if (perfil?.nivel === 3) redirect('/clientes')

  const [
    { count: totalClientes },
    { count: reportesAbiertos },
    { data: productosBajoStock },
  ] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('reportes').select('*', { count: 'exact', head: true }).in('estado', ['abierto', 'en_proceso']),
    supabase.from('productos').select('id, nombre, stock, stock_minimo, unidad')
      .eq('activo', true).filter('stock', 'lte', 'stock_minimo').limit(5),
  ])

  return (
    <DashboardClient
      nivel={perfil?.nivel ?? 2}
      totalClientes={totalClientes ?? 0}
      reportesAbiertos={reportesAbiertos ?? 0}
      productosBajoStock={productosBajoStock ?? []}
      nombre={perfil?.nombre ?? ''}
    />
  )
}

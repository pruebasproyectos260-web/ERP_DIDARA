import { createClient, usuarioDeSesion } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await usuarioDeSesion(supabase)

  // Todo en paralelo (un solo viaje de ida y vuelta a la base de datos)
  const [
    { data: perfil },
    { count: totalClientes },
    { count: reportesAbiertos },
    { data: productos },
  ] = await Promise.all([
    supabase.from('usuarios').select('nivel, nombre').eq('id', user!.id).single(),
    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('reportes').select('*', { count: 'exact', head: true }).in('estado', ['abierto', 'en_proceso']),
    // PostgREST no compara dos columnas entre sí (stock <= stock_minimo), se filtra aquí
    supabase.from('productos').select('id, nombre, stock, stock_minimo, unidad').eq('activo', true).gt('stock_minimo', 0),
  ])

  if (perfil?.nivel === 3) redirect('/clientes')

  const bajoStock = (productos ?? [])
    .filter((p) => Number(p.stock) <= Number(p.stock_minimo))
    .sort((a, b) => (Number(a.stock) - Number(a.stock_minimo)) - (Number(b.stock) - Number(b.stock_minimo)))

  return (
    <DashboardClient
      nivel={perfil?.nivel ?? 2}
      totalClientes={totalClientes ?? 0}
      reportesAbiertos={reportesAbiertos ?? 0}
      productosBajoStock={bajoStock.slice(0, 8)}
      totalBajoStock={bajoStock.length}
      nombre={perfil?.nombre ?? ''}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GastosClient from './GastosClient'

export const dynamic = 'force-dynamic'

export default async function GastosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nivel, nombre')
    .eq('id', user!.id)
    .single()

  if (perfil?.nivel === 3) redirect('/clientes')

  const [
    { data: gastosFijos },
    { data: gastosVariables },
  ] = await Promise.all([
    supabase.from('gastos_fijos').select('*').order('created_at', { ascending: false }),
    supabase.from('gastos_variables').select('*').order('fecha', { ascending: false }),
  ])

  return (
    <GastosClient
      gastosFijosInit={gastosFijos ?? []}
      gastosVariablesInit={gastosVariables ?? []}
      nivel={perfil?.nivel ?? 2}
      usuarioNombre={perfil?.nombre ?? ''}
    />
  )
}

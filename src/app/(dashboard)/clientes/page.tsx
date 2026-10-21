import { createClient, usuarioDeSesion } from '@/lib/supabase/server'
import ClientesClient from './ClientesClient'

export default async function ClientesPage() {
  const supabase = await createClient()
  const user = await usuarioDeSesion(supabase)

  const [{ data: clientes }, { data: perfil }] = await Promise.all([
    supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
    supabase.from('usuarios').select('nivel, es_contador').eq('id', user!.id).single(),
  ])

  return <ClientesClient clientes={clientes ?? []} nivel={perfil?.nivel ?? 2} esContador={perfil?.es_contador ?? false} />
}

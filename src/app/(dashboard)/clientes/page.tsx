import { createClient } from '@/lib/supabase/server'
import ClientesClient from './ClientesClient'

export default async function ClientesPage() {
  const supabase = await createClient()

  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .eq('activo', true)
    .order('nombre')

  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nivel')
    .eq('id', user!.id)
    .single()

  return <ClientesClient clientes={clientes ?? []} nivel={perfil?.nivel ?? 2} />
}

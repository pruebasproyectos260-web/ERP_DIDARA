import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nivel')
    .eq('id', user!.id)
    .single()

  if (!perfil || perfil.nivel > 1) redirect('/dashboard')

  const [{ data: usuarios }, { data: config }] = await Promise.all([
    supabase.from('usuarios').select('*').order('created_at'),
    supabase.from('configuracion').select('*').single(),
  ])

  return <AdminClient usuarios={usuarios ?? []} config={config} />
}

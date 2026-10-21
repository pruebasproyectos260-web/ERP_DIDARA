import { createClient, usuarioDeSesion } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const user = await usuarioDeSesion(supabase)

  // En paralelo; si no es admin se descarta lo demás
  const [{ data: perfil }, { data: usuarios }, { data: config }] = await Promise.all([
    supabase.from('usuarios').select('nivel').eq('id', user!.id).single(),
    supabase.from('usuarios').select('*').order('created_at'),
    supabase.from('configuracion').select('*').single(),
  ])

  if (!perfil || perfil.nivel > 1) redirect('/dashboard')

  return <AdminClient usuarios={usuarios ?? []} config={config} />
}

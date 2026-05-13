import { createClient, createServiceClient } from '@/lib/supabase/server'
import SoftwareClient from './SoftwareClient'

export const dynamic = 'force-dynamic'

export default async function SoftwarePage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  const { data: perfil } = await authClient
    .from('usuarios')
    .select('nivel')
    .eq('id', user!.id)
    .single()

  const supabase = createServiceClient()
  const { data: software } = await supabase
    .from('software')
    .select('*')
    .order('nombre')

  return (
    <SoftwareClient
      softwareInit={software ?? []}
      nivel={perfil?.nivel ?? 2}
    />
  )
}

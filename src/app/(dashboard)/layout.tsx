import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import GastosFijosAlert from '@/components/layout/GastosFijosAlert'
import AgendaAlert from '@/components/layout/AgendaAlert'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single()

  const esContador = perfil?.es_contador ?? false

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar nivel={perfil?.nivel ?? 2} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header user={user} perfil={perfil} esContador={esContador} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <GastosFijosAlert nivel={perfil?.nivel ?? 2} />
      <AgendaAlert userId={user.id} />
    </div>
  )
}

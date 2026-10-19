import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import Shell from '@/components/layout/Shell'
import { COOKIE_SIDEBAR } from '@/components/layout/navegacion'
import GastosFijosAlert from '@/components/layout/GastosFijosAlert'
import AgendaAlert from '@/components/layout/AgendaAlert'

async function keepAlive() {
  const dia = new Date().getDay() // 0=Dom, 1=Lun, 5=Vie
  if (dia !== 1 && dia !== 5) return
  try {
    const sb = createServiceClient()
    const { data } = await sb.from('keep_alive').insert({}).select('id').single()
    if (data?.id) await sb.from('keep_alive').delete().eq('id', data.id)
  } catch { /* silencioso */ }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  void keepAlive()

  const [{ data: perfil }, cookieStore] = await Promise.all([
    supabase.from('usuarios').select('*').eq('id', user.id).single(),
    cookies(),
  ])

  const esContador = perfil?.es_contador ?? false

  return (
    <>
      <Shell
        user={user}
        perfil={perfil}
        esContador={esContador}
        colapsadoInicial={cookieStore.get(COOKIE_SIDEBAR)?.value === '1'}
      >
        {children}
      </Shell>
      <GastosFijosAlert nivel={perfil?.nivel ?? 2} />
      <AgendaAlert userId={user.id} />
    </>
  )
}

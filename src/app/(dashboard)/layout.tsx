import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import Shell from '@/components/layout/Shell'
import { COOKIE_SIDEBAR } from '@/components/layout/navegacion'
import GastosFijosAlert from '@/components/layout/GastosFijosAlert'
import AgendaAlert from '@/components/layout/AgendaAlert'

const MESES_ACTIVIDAD = 6 // el registro de actividad conserva los últimos 6 meses

// Mantenimiento lunes y viernes: mantiene despierto Supabase (plan gratuito)
// y borra el registro de actividad más antiguo que MESES_ACTIVIDAD.
async function keepAlive() {
  const dia = new Date().getDay() // 0=Dom, 1=Lun, 5=Vie
  if (dia !== 1 && dia !== 5) return
  try {
    const sb = createServiceClient()
    const { data } = await sb.from('keep_alive').insert({}).select('id').single()
    if (data?.id) await sb.from('keep_alive').delete().eq('id', data.id)

    const limite = new Date()
    limite.setMonth(limite.getMonth() - MESES_ACTIVIDAD)
    await sb.from('actividad').delete().lt('created_at', limite.toISOString())
  } catch { /* silencioso */ }
}

/** Tickets sin resolver (para el contador del menú); 0 si la mesa de ayuda no está activada */
async function ticketsActivos(): Promise<number> {
  try {
    const { count, error } = await createServiceClient()
      .from('tickets').select('id', { count: 'exact', head: true })
      .not('estado', 'in', '("resuelto","cerrado")')
    return error ? 0 : count ?? 0
  } catch {
    return 0
  }
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

  const [{ data: perfil }, cookieStore, tickets] = await Promise.all([
    supabase.from('usuarios').select('*').eq('id', user.id).single(),
    cookies(),
    ticketsActivos(),
  ])

  const esContador = perfil?.es_contador ?? false

  return (
    <>
      <Shell
        user={user}
        perfil={perfil}
        esContador={esContador}
        colapsadoInicial={cookieStore.get(COOKIE_SIDEBAR)?.value === '1'}
        contadores={{ '/tickets': tickets }}
      >
        {children}
      </Shell>
      <GastosFijosAlert nivel={perfil?.nivel ?? 2} />
      <AgendaAlert userId={user.id} />
    </>
  )
}

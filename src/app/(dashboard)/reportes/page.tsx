import { createClient } from '@/lib/supabase/server'
import ReportesClient from './ReportesClient'

export const dynamic = 'force-dynamic'

export default async function ReportesPage() {
  const supabase = await createClient()

  const [
    { data: reportes },
    { data: clientes },
    { data: tecnicos },
    { data: { user } },
  ] = await Promise.all([
    supabase
      .from('reportes')
      // Sin join a usuarios — resolvemos tecnico manualmente abajo
      .select('*, cliente:clientes(id, nombre), items:reporte_items(*)')
      .order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, nombre, direccion, direcciones').eq('activo', true).order('nombre'),
    supabase.from('usuarios').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.auth.getUser(),
  ])

  // Mapear técnico desde la lista de usuarios usando tecnico_id
  const tecnicosMap = Object.fromEntries((tecnicos ?? []).map((t) => [t.id, t]))
  const reportesConTecnico = (reportes ?? []).map((r) => ({
    ...r,
    tecnico: tecnicosMap[r.tecnico_id as string] ?? undefined,
  }))

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nivel')
    .eq('id', user!.id)
    .single()

  return (
    <ReportesClient
      reportes={reportesConTecnico as never}
      clientes={clientes ?? []}
      tecnicos={tecnicos ?? []}
      nivel={perfil?.nivel ?? 2}
    />
  )
}

import { createClient, createServiceClient, usuarioDeSesion } from '@/lib/supabase/server'
import ReportesClient from './ReportesClient'

export const dynamic = 'force-dynamic'

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ ticket?: string }> }) {
  const { ticket: ticketParam } = await searchParams
  const supabase = await createClient()
  // La política RLS de `usuarios` solo deja ver el propio registro a quien no es admin:
  // la lista de técnicos (id y nombre) se lee con service role tras validar la sesión.
  const servicio = createServiceClient()

  const user = await usuarioDeSesion(supabase)
  const [
    { data: reportes },
    { data: clientes },
    { data: tecnicos },
    { data: perfil },
    { data: pagos },
  ] = await Promise.all([
    supabase
      .from('reportes')
      // Sin join a usuarios — resolvemos tecnico manualmente abajo.
      // Sin firma_cliente: es la imagen de la firma (≈⅔ del peso) y solo la usa el PDF, que la lee aparte.
      .select(`id, folio, cliente_id, fecha_ingreso, fecha_entrega, equipo, marca, modelo, serie, falla_reportada, diagnostico,
        trabajo_realizado, estado, subtotal, total, firma_fecha, tecnico_id, created_at, updated_at, tipo_servicio,
        trabajos_realizados, observaciones, direccion_servicio, evidencias,
        cliente:clientes(id, nombre), items:reporte_items(*)`)
      .order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, nombre, direccion, direcciones').eq('activo', true).order('nombre'),
    servicio.from('usuarios').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('usuarios').select('nivel').eq('id', user!.id).single(),
    // Lo cobrado de cada reporte (Finanzas → Cobranza): para mostrar "Pagado" / "Por cobrar"
    servicio.from('movimientos').select('reporte_id, monto').eq('tipo', 'ingreso').not('reporte_id', 'is', null),
  ])
  const cobrado: Record<number, number> = {}
  for (const p of pagos ?? []) cobrado[p.reporte_id] = (cobrado[p.reporte_id] ?? 0) + Number(p.monto)

  // Mapear técnico desde la lista de usuarios usando tecnico_id
  const tecnicosMap = Object.fromEntries((tecnicos ?? []).map((t) => [t.id, t]))
  const reportesConTecnico = (reportes ?? []).map((r) => ({
    ...r,
    tecnico: tecnicosMap[r.tecnico_id as string] ?? undefined,
  }))

  // Reporte que se crea desde un ticket de la mesa de ayuda (/reportes?ticket=ID)
  let ticketOrigen = null
  if (ticketParam && (perfil?.nivel ?? 3) <= 2) {
    const { data } = await servicio
      .from('tickets').select('id, folio, cliente_id, asunto, descripcion, reporte_id')
      .eq('id', Number(ticketParam)).single()
    if (data && data.cliente_id && !data.reporte_id) ticketOrigen = data
  }

  return (
    <ReportesClient
      reportes={reportesConTecnico as never}
      clientes={clientes ?? []}
      tecnicos={tecnicos ?? []}
      nivel={perfil?.nivel ?? 2}
      ticketOrigen={ticketOrigen}
      cobrado={cobrado}
    />
  )
}

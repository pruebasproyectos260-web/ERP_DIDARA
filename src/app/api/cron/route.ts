import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { origenPublico } from '@/lib/tokens'
import { ahoraMexico } from '@/lib/agenda'
import { envioContableMensual, limpiezaAvisos, recordatoriosAgenda, tokenTareasValido } from '@/lib/tareas'

// Tareas programadas. Supabase (pg_cron) llama aquí cada 15 minutos con ?t=<clave>
// (ver supabase/migracion_tareas.sql). Todo es idempotente: llamarlo de más no repite avisos.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  if (!tokenTareasValido(sp.get('t'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // En pruebas locales se puede simular la hora (nunca en producción)
  const simulada = process.env.CORREO_DESACTIVADO === '1' ? sp.get('ahora') : null
  const ahora = simulada && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(simulada) ? simulada : ahoraMexico()

  const supabase = createServiceClient()
  const resultado: Record<string, unknown> = { ahora }
  try { resultado.agenda = await recordatoriosAgenda(supabase, ahora) } catch (e) { resultado.agenda = `error: ${(e as Error).message}` }
  try { resultado.contabilidad = await envioContableMensual(supabase, origenPublico(req), ahora) } catch (e) { resultado.contabilidad = `error: ${(e as Error).message}` }
  try { await limpiezaAvisos(supabase, ahora) } catch { /* no crítico */ }
  return NextResponse.json(resultado)
}

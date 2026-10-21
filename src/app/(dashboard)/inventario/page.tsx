import { createClient, usuarioDeSesion } from '@/lib/supabase/server'
import { NIVEL } from '@/lib/nivel'
import { ocultarCostosProducto } from '@/lib/campos'
import InventarioClient from './InventarioClient'

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ bajoStock?: string; sinStock?: string }>
}) {
  const { bajoStock, sinStock } = await searchParams
  const supabase = await createClient()
  const user = await usuarioDeSesion(supabase)

  const [{ data: productos }, { data: configData }, { data: perfil }] = await Promise.all([
    supabase.from('productos').select('*').eq('activo', true).order('nombre'),
    supabase.from('configuracion').select('iva_porcentaje').single(),
    supabase.from('usuarios').select('nivel').eq('id', user!.id).single(),
  ])

  const nivel = perfil?.nivel ?? 2

  return (
    <InventarioClient
      productos={nivel >= NIVEL.RESTRINGIDO ? (productos ?? []).map(ocultarCostosProducto) : productos ?? []}
      ivaDefault={configData?.iva_porcentaje ?? 16}
      nivel={nivel}
      filtroInicial={bajoStock ? 'bajo' : sinStock ? 'sinstock' : null}
    />
  )
}

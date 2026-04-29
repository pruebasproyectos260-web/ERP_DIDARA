import { createClient } from '@/lib/supabase/server'
import InventarioClient from './InventarioClient'

export default async function InventarioPage() {
  const supabase = await createClient()

  const [{ data: productos }, { data: configData }, { data: { user } }] = await Promise.all([
    supabase.from('productos').select('*').eq('activo', true).order('nombre'),
    supabase.from('configuracion').select('iva_porcentaje').single(),
    supabase.auth.getUser(),
  ])

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nivel')
    .eq('id', user!.id)
    .single()

  return (
    <InventarioClient
      productos={productos ?? []}
      ivaDefault={configData?.iva_porcentaje ?? 16}
      nivel={perfil?.nivel ?? 2}
    />
  )
}

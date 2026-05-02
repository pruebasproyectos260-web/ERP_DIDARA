import { createClient } from '@/lib/supabase/server'
import CotizacionesClient from './CotizacionesClient'

export default async function CotizacionesPage() {
  const supabase = await createClient()

  const [
    { data: cotizaciones },
    { data: clientes },
    { data: productos },
    { data: configData },
    { data: { user } },
  ] = await Promise.all([
    supabase
      .from('cotizaciones')
      .select('*, cliente:clientes(id, nombre), items:cotizacion_items(*)')
      .order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, nombre, rfc, uso_cfdi, regimen_fiscal, direcciones, contactos').eq('activo', true).order('nombre'),
    supabase.from('productos').select('id, nombre, precio_venta, precio_compra_neto, unidad, imagen_url').eq('activo', true).order('nombre'),
    supabase.from('configuracion').select('iva_porcentaje').single(),
    supabase.auth.getUser(),
  ])

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nivel, es_contador')
    .eq('id', user!.id)
    .single()

  return (
    <CotizacionesClient
      cotizaciones={cotizaciones ?? []}
      clientes={clientes ?? []}
      productos={productos ?? []}
      ivaDefault={configData?.iva_porcentaje ?? 16}
      nivel={perfil?.nivel ?? 2}
      esContador={perfil?.es_contador ?? false}
    />
  )
}

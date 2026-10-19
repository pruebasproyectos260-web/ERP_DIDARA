import { createClient } from '@/lib/supabase/server'
import { NIVEL } from '@/lib/nivel'
import { ocultarCostosCotizacion, ocultarCostosProducto } from '@/lib/campos'
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
    supabase.from('clientes').select('id, nombre, rfc, uso_cfdi, regimen_fiscal, descuento, direcciones, contactos').eq('activo', true).order('nombre'),
    supabase.from('productos').select('id, nombre, precio_venta, precio_compra_neto, unidad, imagen_url').eq('activo', true).order('nombre'),
    supabase.from('configuracion').select('iva_porcentaje').single(),
    supabase.auth.getUser(),
  ])

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nivel, es_contador')
    .eq('id', user!.id)
    .single()

  const nivel = perfil?.nivel ?? 2
  // El nivel 3 no debe recibir costos ni ganancias, aunque la UI ya no los muestre
  const restringido = nivel >= NIVEL.RESTRINGIDO

  return (
    <CotizacionesClient
      cotizaciones={restringido ? (cotizaciones ?? []).map(ocultarCostosCotizacion) : cotizaciones ?? []}
      clientes={clientes ?? []}
      productos={restringido ? (productos ?? []).map(ocultarCostosProducto) : productos ?? []}
      ivaDefault={configData?.iva_porcentaje ?? 16}
      nivel={nivel}
      esContador={perfil?.es_contador ?? false}
    />
  )
}

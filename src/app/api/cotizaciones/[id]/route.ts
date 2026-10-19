import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { CAMPOS, leerJson, ocultarCostosCotizacion, pick, pickItems } from '@/lib/campos'
import { escaparHtml } from '@/lib/html'
import { reemplazarPartidas } from '@/lib/partidas'
import { registrarActividad } from '@/lib/actividad'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const { supabase, nivel } = auth
  const { id } = await params

  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(*), cotizacion_items(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data: nivel >= NIVEL.RESTRINGIDO ? ocultarCostosCotizacion(data) : data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params
  const body = await leerJson(req)
  const cotizacionData = pick(body, CAMPOS.cotizaciones)
  const items = pickItems(body.items, CAMPOS.cotizacion_items)

  // Estado anterior: el correo al contador solo sale cuando CAMBIA a "aceptada"
  const { data: previa } = await supabase
    .from('cotizaciones')
    .select('estado, folio')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('cotizaciones')
    .update(cotizacionData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reemplazar items si se envían
  if (items !== undefined) {
    const errorPartidas = await reemplazarPartidas(supabase, 'cotizacion_items', 'cotizacion_id', id, items)
    if (errorPartidas) return NextResponse.json({ error: errorPartidas }, { status: 500 })
  }

  const { data: completa } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(id, nombre), items:cotizacion_items(*)')
    .eq('id', id)
    .single()

  if (previa) {
    const cambioEstado = cotizacionData.estado !== undefined && cotizacionData.estado !== previa.estado
    await registrarActividad(
      auth,
      cambioEstado ? 'cambiar_estado' : 'editar',
      'cotizaciones',
      id,
      cambioEstado ? `${previa.folio}: ${previa.estado} → ${cotizacionData.estado}` : previa.folio,
    )
  }

  // Auto-email a contadores cuando la cotización pasa a "aceptada" con IVA
  if (cotizacionData.estado === 'aceptada' && previa?.estado !== 'aceptada' && completa) {
    const cot = completa as { folio: string; cliente_nombre?: string; aplica_iva: boolean; iva_monto: number; total: number; cliente?: { nombre: string } }
    const aplica = cot.aplica_iva && Number(cot.iva_monto) > 0
    if (aplica) {
      try {
        const { data: contadores } = await supabase
          .from('usuarios')
          .select('correo, nombre')
          .eq('es_contador', true)
          .neq('correo', null)
        if (contadores?.length) {
          const { enviarCorreo } = await import('@/lib/correo')
          const clienteNombre = cot.cliente?.nombre ?? cot.cliente_nombre ?? 'Cliente'
          const fmtMXN = (n: number) =>
            new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
          await enviarCorreo({
            para: contadores.map((c) => c.correo as string),
            asunto: `Solicitud de Factura — ${cot.folio}`,
            html: `
              <h2 style="color:#1a7a6e">Solicitud de Factura</h2>
              <p>La cotización <strong>${escaparHtml(cot.folio)}</strong> del cliente
                 <strong>${escaparHtml(clienteNombre)}</strong> ha sido marcada como <strong>Aceptada</strong>.</p>
              <table cellpadding="6" style="border-collapse:collapse;margin-top:12px">
                <tr><td style="color:#555">IVA:</td><td><strong>${fmtMXN(Number(cot.iva_monto))}</strong></td></tr>
                <tr><td style="color:#555">Total:</td><td><strong>${fmtMXN(Number(cot.total))}</strong></td></tr>
              </table>
              <p style="margin-top:14px;color:#555">Por favor, proceda a emitir la factura correspondiente.</p>
            `,
          })
        }
      } catch {
        // El email falla silenciosamente para no bloquear la respuesta
      }
    }
  }

  return NextResponse.json({ data: completa })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { id } = await params

  const { data: borradas, error } = await supabase.from('cotizaciones').delete().eq('id', id).select('folio')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (borradas?.length) await registrarActividad(auth, 'eliminar', 'cotizaciones', id, borradas[0].folio)
  return NextResponse.json({ ok: true })
}

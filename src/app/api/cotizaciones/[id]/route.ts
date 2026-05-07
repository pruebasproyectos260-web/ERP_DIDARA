import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(*), cotizacion_items(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await req.json()
  const { items, ...cotizacionData } = body

  const { error } = await supabase
    .from('cotizaciones')
    .update(cotizacionData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reemplazar items si se envían
  if (items !== undefined) {
    await supabase.from('cotizacion_items').delete().eq('cotizacion_id', id)
    if (items.length > 0) {
      await supabase.from('cotizacion_items').insert(
        items.map((item: Record<string, unknown>) => ({ ...item, cotizacion_id: id }))
      )
    }
  }

  const { data: completa } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(id, nombre), items:cotizacion_items(*)')
    .eq('id', id)
    .single()

  // Auto-email a contadores cuando la cotización pasa a "aceptada" con IVA
  if (body.estado === 'aceptada' && completa) {
    const cot = completa as { folio: string; cliente_nombre?: string; aplica_iva: boolean; iva_monto: number; total: number; cliente?: { nombre: string } }
    const aplica = cot.aplica_iva && Number(cot.iva_monto) > 0
    if (aplica) {
      try {
        const svc = createServiceClient()
        const { data: contadores } = await svc
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
              <p>La cotización <strong>${cot.folio}</strong> del cliente
                 <strong>${clienteNombre}</strong> ha sido marcada como <strong>Aceptada</strong>.</p>
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
  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase.from('cotizaciones').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

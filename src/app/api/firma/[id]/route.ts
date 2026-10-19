import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { leerJson } from '@/lib/campos'
import { firmaValida, tokenFirmaValido } from '@/lib/firma'
import { registrarActividad } from '@/lib/actividad'

// Ruta PÚBLICA (sin sesión) para que el cliente firme la conformidad de su reporte.
// Solo funciona con el token del enlace y solo expone folio, cliente y equipo.

const enlaceInvalido = () =>
  NextResponse.json({ error: 'El enlace de firma no es válido. Pide uno nuevo a Didara TI.' }, { status: 403 })

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!tokenFirmaValido(id, req.nextUrl.searchParams.get('t'))) return enlaceInvalido()

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('reportes')
    .select('folio, equipo, firma_fecha, cliente:clientes(nombre)')
    .eq('id', id)
    .single()
  if (!data) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })

  const cliente = data.cliente as { nombre?: string } | { nombre?: string }[] | null
  const clienteNombre = Array.isArray(cliente) ? cliente[0]?.nombre : cliente?.nombre

  return NextResponse.json({
    data: {
      folio: data.folio,
      equipo: data.equipo,
      cliente: clienteNombre ?? '',
      firmado: Boolean(data.firma_fecha),
      firma_fecha: data.firma_fecha,
    },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { t, firma } = await leerJson(req)
  if (!tokenFirmaValido(id, t)) return enlaceInvalido()
  if (!firmaValida(firma)) {
    return NextResponse.json({ error: 'La firma no es válida. Intenta dibujarla de nuevo.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: reporte } = await supabase
    .from('reportes')
    .select('id, folio, firma_fecha')
    .eq('id', id)
    .single()
  if (!reporte) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
  if (reporte.firma_fecha) {
    return NextResponse.json({ error: 'Este reporte ya fue firmado.' }, { status: 409 })
  }

  const { error } = await supabase
    .from('reportes')
    .update({ firma_cliente: firma, firma_fecha: new Date().toISOString(), estado: 'entregado' })
    .eq('id', id)
    .is('firma_fecha', null)

  if (error) return NextResponse.json({ error: 'No se pudo guardar la firma. Intenta de nuevo.' }, { status: 500 })
  await registrarActividad(null, 'firmar', 'reportes', id, `${reporte.folio} firmado por el cliente`)
  return NextResponse.json({ ok: true })
}

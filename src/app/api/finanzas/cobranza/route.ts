import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { errorValidacion, leerJson } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'
import { esquemaPago, faltaMigracionFinanzas, formatoMoneda, hoyMexico, redondear } from '@/lib/finanzas'
import { baseDeDocumento, cuentasPorCobrar, soloFinanzas, sumarCobrado, SELECT_MOVIMIENTO } from '@/lib/finanzas-servidor'

/** Lo que nos deben: cotizaciones aceptadas/facturadas y reportes firmados sin cobrar por completo */
export async function GET() {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado

  const { data, error } = await cuentasPorCobrar(auth.supabase)
  if (error) {
    if (faltaMigracionFinanzas(error)) return NextResponse.json({ data: [], pendiente: true })
    return NextResponse.json({ error: 'No se pudo cargar la cobranza' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

/**
 * Registrar un pago recibido (puede ser parcial).
 * "monto" es el importe SIN IVA que se abona; con factura se le suma el IVA (ver lib/finanzas.ts).
 */
export async function POST(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado
  const { supabase } = auth

  const parsed = esquemaPago.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const p = parsed.data
  const esCot = p.origen === 'cotizacion'

  const doc = esCot
    ? (await supabase.from('cotizaciones').select('id, folio, fecha, estado, total, aplica_iva, iva_monto, cliente_id').eq('id', p.id).single()).data
    : (await supabase.from('reportes').select('id, folio, fecha_ingreso, fecha_entrega, total, cliente_id').eq('id', p.id).single()).data
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const { data: pagos } = await supabase.from('movimientos').select('monto, iva')
    .eq('tipo', 'ingreso').eq(esCot ? 'cotizacion_id' : 'reporte_id', p.id)
  const { base, tasa, conFactura: facturaPorDefecto } = baseDeDocumento(doc, esCot)
  const { cobradoBase } = sumarCobrado(pagos ?? [])
  const saldoBase = redondear(base - cobradoBase)
  if (saldoBase <= 0.009) return NextResponse.json({ error: `${doc.folio} ya está cobrado por completo` }, { status: 409 })

  const abono = p.ya_cobrado ? saldoBase : (p.monto ?? saldoBase)
  if (abono > saldoBase + 0.009) return NextResponse.json({ error: `El pago es mayor que lo pendiente (${formatoMoneda(saldoBase)} sin IVA)` }, { status: 400 })

  const conFactura = p.con_factura ?? facturaPorDefecto
  const iva = conFactura ? redondear(abono * tasa) : null
  const monto = redondear(abono + (iva ?? 0)) // lo que realmente recibimos

  const cot = esCot ? doc as { fecha: string; estado: string } : null
  const rep = !esCot ? doc as { fecha_ingreso: string; fecha_entrega: string | null } : null
  const fechaDoc = cot?.fecha ?? rep?.fecha_entrega ?? rep?.fecha_ingreso ?? hoyMexico()
  const parcial = abono < saldoBase - 0.009 || cobradoBase > 0

  const { data: movimiento, error } = await supabase.from('movimientos').insert({
    tipo: 'ingreso',
    fecha: p.ya_cobrado ? fechaDoc : (p.fecha ?? hoyMexico()),
    categoria: esCot ? 'Cotización' : 'Servicio',
    descripcion: `${parcial ? 'Pago parcial · ' : ''}${esCot ? 'Cotización' : 'Reporte'} ${doc.folio}`,
    monto,
    metodo_pago: p.metodo_pago,
    con_factura: conFactura,
    iva,
    cliente_id: doc.cliente_id,
    cotizacion_id: esCot ? doc.id : null,
    reporte_id: esCot ? null : doc.id,
    registrado_por: auth.userId,
    registrado_nombre: auth.nombre,
    revisado: true,
    revisado_por: auth.nombre,
    revisado_at: new Date().toISOString(),
    importado: p.ya_cobrado,
  }).select(SELECT_MOVIMIENTO).single()
  if (error) return NextResponse.json({ error: 'No se pudo registrar el pago' }, { status: 500 })

  const nuevoSaldoBase = redondear(saldoBase - abono)
  await registrarActividad(auth, 'registrar_pago', esCot ? 'cotizaciones' : 'reportes', doc.id,
    `${doc.folio}: ${p.ya_cobrado ? 'ya estaba cobrado' : `pago de ${formatoMoneda(monto)}${iva ? ` (IVA ${formatoMoneda(iva)})` : ''}`}` +
    (nuevoSaldoBase > 0.009 ? ` · resta ${formatoMoneda(nuevoSaldoBase)} sin IVA` : ' · liquidado'))

  // Cotización liquidada → pasa a "pagada"
  if (cot && nuevoSaldoBase <= 0.009 && cot.estado !== 'pagada') {
    await supabase.from('cotizaciones').update({ estado: 'pagada', updated_at: new Date().toISOString() }).eq('id', doc.id)
    await registrarActividad(auth, 'cambiar_estado', 'cotizaciones', doc.id, `${doc.folio}: ${cot.estado} → pagada (cobranza)`)
  }

  return NextResponse.json({
    data: { movimiento, saldo_base: Math.max(0, nuevoSaldoBase), liquidado: nuevoSaldoBase <= 0.009 },
  }, { status: 201 })
}

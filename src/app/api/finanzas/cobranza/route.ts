import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { errorValidacion, leerJson } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'
import { esquemaPago, faltaMigracionFinanzas, formatoMoneda, hoyMexico, ivaIncluido, redondear } from '@/lib/finanzas'
import { cuentasPorCobrar, soloFinanzas, SELECT_MOVIMIENTO } from '@/lib/finanzas-servidor'

/** Lo que nos deben: cotizaciones aceptadas/facturadas y reportes con importe sin cobrar por completo */
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

/** Registrar un pago recibido (puede ser parcial) */
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

  const { data: pagos } = await supabase.from('movimientos').select('monto')
    .eq('tipo', 'ingreso').eq(esCot ? 'cotizacion_id' : 'reporte_id', p.id)
  const total = Number(doc.total)
  const cobrado = redondear((pagos ?? []).reduce((a, x) => a + Number(x.monto), 0))
  const saldo = redondear(total - cobrado)
  if (saldo <= 0) return NextResponse.json({ error: `${doc.folio} ya está cobrado por completo` }, { status: 409 })

  const monto = p.ya_cobrado ? saldo : (p.monto ?? saldo)
  if (monto > saldo + 0.009) return NextResponse.json({ error: `El pago es mayor que lo pendiente (${formatoMoneda(saldo)})` }, { status: 400 })

  const cot = esCot ? doc as { fecha: string; estado: string; aplica_iva: boolean; iva_monto: number } : null
  const rep = !esCot ? doc as { fecha_ingreso: string; fecha_entrega: string | null } : null
  const fechaDoc = cot?.fecha ?? rep?.fecha_entrega ?? rep?.fecha_ingreso ?? hoyMexico()
  const conFactura = p.con_factura ?? !!cot?.aplica_iva
  // IVA proporcional al pago si la cotización lo desglosa; si no, el 16 % incluido
  const iva = !conFactura ? null
    : cot?.aplica_iva && total > 0 ? redondear(Number(cot.iva_monto) * monto / total) : ivaIncluido(monto)
  const parcial = monto < saldo - 0.009 || cobrado > 0

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

  const nuevoSaldo = redondear(saldo - monto)
  await registrarActividad(auth, 'registrar_pago', esCot ? 'cotizaciones' : 'reportes', doc.id,
    `${doc.folio}: ${p.ya_cobrado ? 'ya estaba cobrado' : `pago de ${formatoMoneda(monto)}`}${nuevoSaldo > 0 ? ` · resta ${formatoMoneda(nuevoSaldo)}` : ' · liquidado'}`)

  // Cotización liquidada → pasa a "pagada"
  if (cot && nuevoSaldo <= 0.009 && cot.estado !== 'pagada') {
    await supabase.from('cotizaciones').update({ estado: 'pagada', updated_at: new Date().toISOString() }).eq('id', doc.id)
    await registrarActividad(auth, 'cambiar_estado', 'cotizaciones', doc.id, `${doc.folio}: ${cot.estado} → pagada (cobranza)`)
  }

  return NextResponse.json({ data: { movimiento, saldo: Math.max(0, nuevoSaldo), liquidado: nuevoSaldo <= 0.009 } }, { status: 201 })
}

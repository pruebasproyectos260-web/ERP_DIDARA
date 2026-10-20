import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { errorValidacion, leerJson } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'
import {
  esquemaMarcarMes, esquemaMes, formatoMoneda, hoyMexico, ivaIncluido, ivaSobre, nombreMes, recurrenteVigente, redondear, vencimiento,
} from '@/lib/finanzas'
import { soloFinanzas, SELECT_MOVIMIENTO } from '@/lib/finanzas-servidor'

// Marcar ✓ un pago/cobro fijo en un mes = registrar el movimiento real de ese mes.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado
  const { id } = await params

  const parsed = esquemaMarcarMes.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { mes, monto, fecha, metodo_pago } = parsed.data

  const { data: r } = await auth.supabase.from('fin_recurrentes').select('*').eq('id', id).single()
  if (!r) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (!recurrenteVigente(r, mes)) return NextResponse.json({ error: `No aplica en ${nombreMes(mes)}` }, { status: 400 })

  const importe = monto ?? Number(r.monto)
  if (!(importe > 0)) return NextResponse.json({ error: 'Escribe el monto' }, { status: 400 })
  const hoy = hoyMexico()
  // Pago con factura: el monto ya trae IVA y se extrae. Cobro con factura: el monto es sin IVA y se suma.
  const sumaIva = r.tipo === 'ingreso' && r.con_factura
  const iva = !r.con_factura ? null : sumaIva ? ivaSobre(importe) : ivaIncluido(importe)
  const montoReal = sumaIva ? redondear(importe + (iva ?? 0)) : importe

  const { data, error } = await auth.supabase.from('movimientos').insert({
    tipo: r.tipo,
    // Si se marca en el mismo mes, con la fecha de hoy; si es otro mes, en su día de vencimiento
    fecha: fecha ?? (hoy.startsWith(mes) ? hoy : vencimiento(mes, r.dia)),
    categoria: r.categoria,
    descripcion: `${r.nombre} · ${nombreMes(mes)}`,
    monto: montoReal,
    metodo_pago: metodo_pago ?? r.metodo_pago,
    con_factura: r.con_factura,
    iva,
    cliente_id: r.cliente_id,
    recurrente_id: r.id,
    mes_recurrente: mes,
    registrado_por: auth.userId,
    registrado_nombre: auth.nombre,
    revisado: true,
    revisado_por: auth.nombre,
    revisado_at: new Date().toISOString(),
  }).select(SELECT_MOVIMIENTO).single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya estaba marcado en ese mes' }, { status: 409 })
    return NextResponse.json({ error: 'No se pudo registrar' }, { status: 500 })
  }
  await registrarActividad(auth, 'registrar_pago', 'fin_recurrentes', r.id,
    `${r.tipo === 'gasto' ? 'Pagó' : 'Cobró'} ${r.nombre} de ${nombreMes(mes)}: ${formatoMoneda(montoReal)}${iva ? ` (IVA ${formatoMoneda(iva)})` : ''}`)
  return NextResponse.json({ data }, { status: 201 })
}

/** Desmarcar: borra el movimiento de ese mes */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado
  const { id } = await params

  const mes = esquemaMes.safeParse(req.nextUrl.searchParams.get('mes'))
  if (!mes.success) return NextResponse.json({ error: 'Mes inválido' }, { status: 400 })

  const { data: borrados, error } = await auth.supabase.from('movimientos').delete()
    .eq('recurrente_id', id).eq('mes_recurrente', mes.data).select('descripcion, monto, comprobantes')
  if (error) return NextResponse.json({ error: 'No se pudo desmarcar' }, { status: 500 })
  const archivos = (borrados ?? []).flatMap((b) => b.comprobantes ?? [])
  if (archivos.length) await auth.supabase.storage.from('documentos').remove(archivos)
  if (borrados?.length) await registrarActividad(auth, 'eliminar', 'movimientos', null, `Desmarcó ${borrados[0].descripcion} (${formatoMoneda(Number(borrados[0].monto))})`)
  return NextResponse.json({ ok: true })
}

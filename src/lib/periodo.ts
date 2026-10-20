import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hoyMexico, rangoMes } from '@/lib/finanzas'

// Periodo de los reportes de contabilidad: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (por defecto, el mes actual)

const dia = z.iso.date()

export function leerPeriodo(sp: URLSearchParams): { desde: string; hasta: string } | NextResponse {
  const porDefecto = rangoMes(hoyMexico().slice(0, 7))
  const desde = dia.safeParse(sp.get('desde') ?? porDefecto.desde)
  const hasta = dia.safeParse(sp.get('hasta') ?? porDefecto.hasta)
  if (!desde.success || !hasta.success) return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
  if (desde.data > hasta.data) return NextResponse.json({ error: 'La fecha inicial es posterior a la final' }, { status: 400 })
  if (Date.parse(hasta.data) - Date.parse(desde.data) > 400 * 86_400_000) {
    return NextResponse.json({ error: 'El periodo no puede ser mayor a un año' }, { status: 400 })
  }
  return { desde: desde.data, hasta: hasta.data }
}

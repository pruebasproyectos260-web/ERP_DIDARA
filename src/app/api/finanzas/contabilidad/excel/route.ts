import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { registrarActividad } from '@/lib/actividad'
import { soloFinanzas } from '@/lib/finanzas-servidor'
import { datosContables } from '@/lib/contabilidad'
import { excelContable } from '@/lib/excel-contable'
import { nombreArchivo } from '@/lib/contabilidad-correo'
import { leerPeriodo } from '@/lib/periodo'
import { origenPublico } from '@/lib/tokens'

/** Descarga el Excel para contabilidad del periodo */
export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado

  const periodo = leerPeriodo(req.nextUrl.searchParams)
  if (periodo instanceof NextResponse) return periodo
  try {
    const datos = await datosContables(auth.supabase, periodo.desde, periodo.hasta)
    const excel = await excelContable(datos, origenPublico(req))
    await registrarActividad(auth, 'respaldo', 'movimientos', null, `Descargó Excel de contabilidad: ${datos.titulo}`)
    return new NextResponse(new Uint8Array(excel), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombreArchivo(periodo.desde, periodo.hasta)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo generar el Excel' }, { status: 500 })
  }
}

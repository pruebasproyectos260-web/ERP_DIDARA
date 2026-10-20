import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { soloFinanzas } from '@/lib/finanzas-servidor'
import { datosContables } from '@/lib/contabilidad'
import { destinatariosContables } from '@/lib/contabilidad-correo'
import { leerPeriodo } from '@/lib/periodo'

/** Resumen para contabilidad del periodo (pantalla) */
export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado

  const periodo = leerPeriodo(req.nextUrl.searchParams)
  if (periodo instanceof NextResponse) return periodo
  try {
    const [datos, destinatarios] = await Promise.all([
      datosContables(auth.supabase, periodo.desde, periodo.hasta),
      destinatariosContables(auth.supabase),
    ])
    return NextResponse.json({ data: { ...datos, destinatarios } })
  } catch {
    return NextResponse.json({ error: 'No se pudo armar el reporte' }, { status: 500 })
  }
}

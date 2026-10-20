import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { leerJson } from '@/lib/campos'
import { registrarActividad } from '@/lib/actividad'
import { soloFinanzas } from '@/lib/finanzas-servidor'
import { enviarReporteContable } from '@/lib/contabilidad-correo'
import { leerPeriodo } from '@/lib/periodo'
import { origenPublico } from '@/lib/tokens'

/** Envía ahora el Excel del periodo por correo a contabilidad */
export async function POST(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  const denegado = soloFinanzas(auth)
  if (denegado) return denegado

  const body = await leerJson(req)
  const periodo = leerPeriodo(new URLSearchParams({ desde: String(body.desde ?? ''), hasta: String(body.hasta ?? '') }))
  if (periodo instanceof NextResponse) return periodo
  try {
    const envio = await enviarReporteContable(auth.supabase, origenPublico(req), periodo.desde, periodo.hasta)
    await registrarActividad(auth, 'respaldo', 'movimientos', null, `Envió a contabilidad: ${envio.titulo} → ${envio.para.join(', ')}`)
    return NextResponse.json({ data: envio })
  } catch {
    return NextResponse.json({ error: 'No se pudo enviar el correo' }, { status: 500 })
  }
}

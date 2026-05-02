import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data: gastos } = await supabase.from('gastos_fijos').select('*').not('dia', 'is', null)

  if (!gastos?.length) return NextResponse.json({ data: [] })

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const proximos = gastos
    .map((g) => {
      let venc = new Date(hoy.getFullYear(), hoy.getMonth(), g.dia)
      if (venc < hoy) {
        venc = new Date(hoy.getFullYear(), hoy.getMonth() + 1, g.dia)
      }
      const diasRestantes = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000)
      return { ...g, diasRestantes, fechaVencimiento: venc.toISOString().slice(0, 10) }
    })
    .filter((g) => g.diasRestantes >= 0 && g.diasRestantes <= 5)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  return NextResponse.json({ data: proximos })
}

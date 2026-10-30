import { NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { precalentar } from '@/lib/navegador'

// Al abrir Reportes o Cotizaciones el navegador pide esto: Chrome se abre en segundo plano
// y el PDF sale sin la espera de arrancarlo. No espera a que termine.
export async function POST() {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  void precalentar().catch(() => {})
  return NextResponse.json({ ok: true }, { status: 202 })
}

import { NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { enviarPush } from '@/lib/push'

/** Manda un aviso de prueba a todos los dispositivos del usuario */
export async function POST() {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth

  const enviados = await enviarPush(auth.supabase, [auth.userId], {
    titulo: '🔔 Avisos de Didara ERP',
    cuerpo: 'Así te llegarán los tickets nuevos y las respuestas de los clientes.',
    url: '/tickets',
    etiqueta: 'prueba',
  })
  return NextResponse.json({ data: { enviados } })
}

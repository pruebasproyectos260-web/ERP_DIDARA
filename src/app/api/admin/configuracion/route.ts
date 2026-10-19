import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { errorValidacion, leerJson } from '@/lib/campos'
import { camposCambiados, registrarActividad } from '@/lib/actividad'

export async function GET() {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth

  const { data, error } = await auth.supabase.from('configuracion').select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

const textoPago = z.string().trim().max(100).nullish()

const esquemaConfig = z.object({
  iva_porcentaje:    z.number('El IVA debe ser un número').min(0).max(100).optional(),
  empresa_nombre:    z.string().trim().max(200).optional(),
  empresa_direccion: z.string().trim().max(500).optional(),
  empresa_telefono:  z.string().trim().max(50).optional(),
  empresa_email:     z.string().trim().max(200).optional(),
  empresa_web:       z.string().trim().max(200).optional(),
  pago_banco:        textoPago,
  pago_cuenta:       textoPago,
  pago_clabe:        textoPago,
  pago_titular:      textoPago,
  pago_mostrar:      z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth

  const parsed = esquemaConfig.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)

  const { data, error } = await auth.supabase
    .from('configuracion')
    .update({ ...parsed.data, updated_by: auth.userId, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarActividad(auth, 'editar', 'configuracion', 1, camposCambiados(parsed.data))
  return NextResponse.json({ data })
}

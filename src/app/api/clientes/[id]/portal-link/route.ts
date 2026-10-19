import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { z } from 'zod'
import { urlPortal } from '@/lib/portal'
import { errorValidacion, leerJson } from '@/lib/campos'
import { escaparHtml } from '@/lib/html'
import { enviarCorreo } from '@/lib/correo'
import { CORREO_DIRECCION, botonCorreo, plantillaCorreo } from '@/lib/plantilla-correo'
import { registrarActividad } from '@/lib/actividad'

// Enlace al portal de soporte del cliente (para mandárselo por WhatsApp o correo)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { data: cliente } = await auth.supabase.from('clientes').select('id, nombre').eq('id', id).single()
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  return NextResponse.json({ data: { cliente: cliente.nombre, url: urlPortal(req, cliente.id) } })
}

const esquemaEnvio = z.object({ email: z.email('El correo no es válido') })

// Envía el enlace del portal por correo al cliente
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const parsed = esquemaEnvio.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)

  const { data: cliente } = await auth.supabase.from('clientes').select('id, nombre').eq('id', id).single()
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const contenido = `
    <p style="margin:0 0 14px;color:#374151;">Estimado(a) <strong>${escaparHtml(cliente.nombre)}</strong>,</p>
    <p style="margin:0 0 14px;color:#374151;">Ponemos a su disposición su <strong>portal de soporte de Didara TI</strong>. Desde ahí puede reportarnos cualquier problema técnico y dar seguimiento a cada solicitud.</p>
    <ul style="margin:0 0 6px;padding-left:20px;color:#374151;font-size:.9rem;line-height:1.7;">
      <li>Cada solicitud recibe un folio y puede ver su estado en todo momento.</li>
      <li>Puede marcarla como urgente si el problema detiene su operación.</li>
      <li>Le recomendamos guardar este enlace en sus favoritos: es exclusivo de su empresa.</li>
    </ul>
    ${botonCorreo('Abrir mi portal de soporte', urlPortal(req, cliente.id))}`

  try {
    await enviarCorreo({
      para: parsed.data.email,
      cc: CORREO_DIRECCION,
      asunto: `Su portal de soporte — Didara TI`,
      html: plantillaCorreo('Portal de soporte', escaparHtml(cliente.nombre), contenido),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo enviar el correo' }, { status: 500 })
  }

  await registrarActividad(auth, 'editar', 'clientes', cliente.id, `${cliente.nombre}: enlace del portal enviado a ${parsed.data.email}`)
  return NextResponse.json({ ok: true })
}

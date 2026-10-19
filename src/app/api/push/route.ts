import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireNivel } from '@/lib/auth'
import { errorValidacion, leerJson } from '@/lib/campos'
import { faltaMigracion } from '@/lib/tickets'
import { clavesPush } from '@/lib/push'

// Activar / desactivar avisos push en el dispositivo actual.

const faltaActivar = () => NextResponse.json(
  { error: 'Falta activar los avisos en Supabase (supabase/migracion_avisos.sql)', pendiente: true }, { status: 503 })

// Solo servicios push reales de los navegadores (evita que el servidor haga peticiones a cualquier URL)
const SERVICIO_PUSH = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)\//i
const endpoint = z.string().max(1000).regex(SERVICIO_PUSH, 'Servicio de avisos no reconocido')
const clave = z.string().min(10).max(200).regex(/^[A-Za-z0-9_\-=]+$/)

const esquemaSuscripcion = z.object({
  endpoint,
  keys: z.object({ p256dh: clave, auth: clave }),
  /** Suscripción vieja que el navegador reemplazó (pushsubscriptionchange) */
  anterior: endpoint.optional(),
})

function nombreDispositivo(ua: string) {
  const navegador = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'App'
  const sistema = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : 'otro equipo'
  return `${navegador} en ${sistema}`
}

/** Clave pública para que el navegador se suscriba */
export async function GET() {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth
  try {
    const { publica } = await clavesPush(auth.supabase)
    return NextResponse.json({ data: { publica } })
  } catch (e) {
    if (faltaMigracion(e as { code?: string })) return faltaActivar()
    return NextResponse.json({ error: 'No se pudieron preparar los avisos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth

  const parsed = esquemaSuscripcion.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { endpoint, keys, anterior } = parsed.data

  if (anterior && anterior !== endpoint) {
    await auth.supabase.from('push_suscripciones').delete().eq('endpoint', anterior).eq('usuario_id', auth.userId)
  }
  const { error } = await auth.supabase.from('push_suscripciones').upsert({
    usuario_id: auth.userId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    dispositivo: nombreDispositivo(req.headers.get('user-agent') ?? ''),
  }, { onConflict: 'endpoint' })
  if (error) {
    if (faltaMigracion(error)) return faltaActivar()
    return NextResponse.json({ error: 'No se pudieron activar los avisos' }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth

  const { endpoint } = await leerJson(req)
  if (typeof endpoint !== 'string' || !endpoint) return NextResponse.json({ error: 'Falta el dispositivo' }, { status: 400 })
  await auth.supabase.from('push_suscripciones').delete().eq('endpoint', endpoint).eq('usuario_id', auth.userId)
  return NextResponse.json({ ok: true })
}

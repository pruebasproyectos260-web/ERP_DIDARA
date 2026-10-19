import webpush from 'web-push'
import type { Sesion } from '@/lib/auth'
import { CORREO_DIRECCION } from '@/lib/plantilla-correo'

// Avisos push: notificaciones del sistema en celular/computadora aunque el ERP esté cerrado.
// El navegador de cada dispositivo entrega su "suscripción" (ver /api/push) y aquí se le envía el aviso.

type Supabase = Sesion['supabase']

export interface AvisoPush {
  titulo: string
  cuerpo: string
  /** Página que se abre al tocar la notificación */
  url: string
  /** Avisos con la misma etiqueta se reemplazan en lugar de amontonarse */
  etiqueta?: string
  urgente?: boolean
}

let clavesEnMemoria: { publica: string; privada: string } | null = null

/** Claves VAPID del servidor: se generan la primera vez y quedan guardadas en Supabase */
export async function clavesPush(supabase: Supabase) {
  if (clavesEnMemoria) return clavesEnMemoria
  const leer = () => supabase.from('push_claves').select('publica, privada').eq('id', 1).maybeSingle()

  const { data, error } = await leer()
  if (error) throw error
  if (data) return (clavesEnMemoria = data)

  // Si dos peticiones las generan a la vez, se queda la primera que se guardó
  const nuevas = webpush.generateVAPIDKeys()
  await supabase.from('push_claves')
    .upsert({ id: 1, publica: nuevas.publicKey, privada: nuevas.privateKey }, { onConflict: 'id', ignoreDuplicates: true })
  const { data: guardadas, error: errGuardar } = await leer()
  if (errGuardar || !guardadas) throw errGuardar ?? new Error('No se pudieron guardar las claves push')
  return (clavesEnMemoria = guardadas)
}

/**
 * Pruebas locales: solo se avisa a las cuentas temporales de prueba (zz_prueba_…), nunca a los
 * dispositivos del equipo. OJO: las cuentas reales también usan el dominio @didara-erp.local.
 */
async function soloCuentasDePrueba(supabase: Supabase, ids: string[]) {
  const permitidos: string[] = []
  for (const id of ids) {
    const { data } = await supabase.auth.admin.getUserById(id)
    if (data.user?.email?.startsWith('zz_prueba_')) permitidos.push(id)
  }
  return permitidos
}

/** Envía el aviso a todos los dispositivos de esos usuarios. Devuelve a cuántos llegó; nunca lanza error. */
export async function enviarPush(supabase: Supabase, usuarioIds: (string | null | undefined)[], aviso: AvisoPush): Promise<number> {
  try {
    let ids = [...new Set(usuarioIds.filter((id): id is string => !!id))]
    if (process.env.CORREO_DESACTIVADO === '1') ids = await soloCuentasDePrueba(supabase, ids)
    if (!ids.length) return 0

    const { data: suscripciones, error } = await supabase
      .from('push_suscripciones').select('id, endpoint, p256dh, auth').in('usuario_id', ids)
    if (error || !suscripciones?.length) return 0

    const { publica, privada } = await clavesPush(supabase)
    const opciones = {
      vapidDetails: { subject: `mailto:${CORREO_DIRECCION}`, publicKey: publica, privateKey: privada },
      TTL: 60 * 60 * 24, // si el celular está apagado, el aviso espera hasta un día
      urgency: aviso.urgente ? 'high' as const : 'normal' as const,
      timeout: 8000,
    }
    const contenido = JSON.stringify(aviso)

    const resultados = await Promise.all(suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, contenido, opciones)
        return true
      } catch (e) {
        // 404/410: el dispositivo desactivó los avisos o desinstaló la app → se olvida
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await supabase.from('push_suscripciones').delete().eq('id', s.id)
        return false
      }
    }))
    return resultados.filter(Boolean).length
  } catch {
    return 0 // el aviso nunca debe impedir que se guarde un ticket
  }
}

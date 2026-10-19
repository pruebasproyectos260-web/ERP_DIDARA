// Avisos push del lado del navegador: activar/desactivar en este dispositivo.
// Las notificaciones las recibe /public/sw.js aunque el ERP esté cerrado.

export type EstadoAvisos = 'cargando' | 'no-soportado' | 'instalar-iphone' | 'bloqueado' | 'inactivo' | 'activo'

const soportaPush = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** iPhone/iPad solo permiten avisos si el ERP se agregó a la pantalla de inicio */
const esIphoneSinInstalar = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator as Navigator & { standalone?: boolean }).standalone

function base64ABytes(b64: string) {
  const crudo = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0))
}

function bytesABase64(buffer: ArrayBuffer | null) {
  if (!buffer) return ''
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function suscripcionActual() {
  const registro = await navigator.serviceWorker.getRegistration('/')
  return (await registro?.pushManager.getSubscription()) ?? null
}

async function guardarEnServidor(sub: PushSubscription) {
  const r = await fetch('/api/push', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()),
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'No se pudieron activar los avisos')
}

export async function estadoAvisos(): Promise<EstadoAvisos> {
  if (!soportaPush()) return esIphoneSinInstalar() ? 'instalar-iphone' : 'no-soportado'
  if (Notification.permission === 'denied') return 'bloqueado'
  if (Notification.permission !== 'granted') return 'inactivo'
  return (await suscripcionActual()) ? 'activo' : 'inactivo'
}

/** Pide permiso, suscribe este dispositivo y lo registra a nombre del usuario. Lanza Error con mensaje legible. */
export async function activarAvisos() {
  // Si ya dio permiso antes no se vuelve a preguntar (algunos navegadores dejan la petición colgada)
  const permiso = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permiso === 'denied') throw new Error('Bloqueaste los avisos. Para activarlos, permite las notificaciones de este sitio en la configuración del navegador.')
  if (permiso !== 'granted') throw new Error('Necesitas permitir las notificaciones para recibir avisos.')

  const r = await fetch('/api/push')
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'No se pudieron preparar los avisos')
  const clave: string = j.data.publica

  const registro = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready
  let sub = await registro.pushManager.getSubscription()
  // Suscripción hecha con otra clave del servidor: hay que rehacerla
  if (sub && bytesABase64(sub.options.applicationServerKey) !== clave) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ABytes(clave) })
  await guardarEnServidor(sub)
}

/** Deja de recibir avisos en este dispositivo */
export async function desactivarAvisos() {
  const sub = await suscripcionActual()
  if (!sub) return
  await fetch('/api/push', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {})
  await sub.unsubscribe()
}

/**
 * Al cerrar sesión: el servidor deja de avisarle a este usuario en este dispositivo.
 * El permiso del navegador se conserva; al volver a entrar se registra solo (ver sincronizarAvisos).
 */
export async function olvidarDispositivo() {
  if (!soportaPush()) return
  const sub = await suscripcionActual().catch(() => null)
  if (!sub) return
  await fetch('/api/push', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {})
}

/** Al abrir el ERP: si este dispositivo tiene avisos activos, confirma que el servidor lo tenga registrado */
export async function sincronizarAvisos() {
  if (!soportaPush() || Notification.permission !== 'granted') return
  const sub = await suscripcionActual().catch(() => null)
  if (sub) await guardarEnServidor(sub).catch(() => {})
}

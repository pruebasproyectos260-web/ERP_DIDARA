// Service worker de Didara ERP: solo recibe los avisos push y abre el ticket al tocarlos.
// No guarda páginas en caché (el ERP siempre carga datos frescos del servidor).

function base64ABytes(b64) {
  const crudo = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0))
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let aviso = {}
  try { aviso = e.data ? e.data.json() : {} } catch { aviso = { cuerpo: e.data ? e.data.text() : '' } }

  e.waitUntil(self.registration.showNotification(aviso.titulo || 'Didara ERP', {
    body: aviso.cuerpo || '',
    icon: '/icono-192.png',
    badge: '/insignia.png',
    tag: aviso.etiqueta || undefined,
    renotify: Boolean(aviso.etiqueta),
    requireInteraction: Boolean(aviso.urgente), // los urgentes se quedan en pantalla hasta atenderlos
    vibrate: aviso.urgente ? [250, 120, 250, 120, 250] : [180],
    data: { url: aviso.url || '/tickets' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  let destino = new URL(e.notification.data?.url || '/tickets', self.location.origin)
  if (destino.origin !== self.location.origin) destino = new URL('/tickets', self.location.origin)

  e.waitUntil((async () => {
    // Si el ERP ya está abierto, se reutiliza esa ventana (la página navega sin recargar)
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin)
    if (abierta) {
      await abierta.focus()
      abierta.postMessage({ tipo: 'abrir', url: destino.pathname + destino.search })
      return
    }
    await self.clients.openWindow(destino.href)
  })())
})

// El navegador renovó la suscripción: se registra la nueva para no dejar de recibir avisos
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    const r = await fetch('/api/push')
    if (!r.ok) return
    const { data } = await r.json()
    const nueva = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ABytes(data.publica),
    })
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nueva.toJSON(), anterior: e.oldSubscription?.endpoint }),
    })
  })())
})

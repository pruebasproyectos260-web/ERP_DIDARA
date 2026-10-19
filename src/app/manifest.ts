import type { MetadataRoute } from 'next'

// Permite "Agregar a pantalla de inicio" (necesario en iPhone para recibir avisos push)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Didara ERP',
    short_name: 'Didara ERP',
    description: 'Sistema de gestión Didara TI',
    lang: 'es-MX',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#187d78',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icono-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

// Validación de imágenes subidas a buckets públicos de Storage.
// Solo imágenes rasterizadas: SVG puede llevar <script> y se sirve desde un dominio público.

export const MAX_BYTES_IMAGEN = 15 * 1024 * 1024 // 15 MB (fotos de celular sin comprimir)

export function esImagenPermitida(mimeType: unknown): mimeType is string {
  return typeof mimeType === 'string'
    && /^image\/[a-z0-9.+-]+$/i.test(mimeType)
    && !/svg/i.test(mimeType)
}

/** Extensión segura derivada del tipo MIME (no del nombre que manda el cliente). */
export function extensionDeMime(mimeType: string): string {
  const sub = mimeType.split('/')[1]?.toLowerCase() ?? 'jpg'
  return sub === 'jpeg' ? 'jpg' : sub.replace(/[^a-z0-9]/g, '') || 'jpg'
}

/** Segmento de ruta seguro para Storage (evita ../ y caracteres raros). */
export function segmentoSeguro(valor: unknown, porDefecto: string): string {
  const limpio = typeof valor === 'string' ? valor.replace(/[^a-z0-9_-]/gi, '_').slice(0, 64) : ''
  return limpio || porDefecto
}

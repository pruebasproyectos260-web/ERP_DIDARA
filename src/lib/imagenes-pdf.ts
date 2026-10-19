import sharp from 'sharp'

// Imágenes para los PDFs: se descargan en el servidor, se reducen al tamaño en que
// se imprimen y se incrustan como data URI. Así Chrome no espera a la red, las fotos
// de celular (hasta 4 MB) no inflan el PDF, y los enlaces que no son imagen
// (p. ej. páginas de Google Drive) se descartan en vez de bloquear la generación.

const TIEMPO_MAX_MS = 6000
const MAX_EN_MEMORIA = 300

const cache = new Map<string, Promise<string | null>>()

async function procesar(url: string, anchoMax: number): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIEMPO_MAX_MS) })
    const tipo = res.headers.get('content-type') ?? ''
    if (!res.ok || !tipo.startsWith('image/')) return null

    const original = Buffer.from(await res.arrayBuffer())
    try {
      const imagen = sharp(original)
        .rotate() // respeta la orientación EXIF de las fotos de celular
        .resize({ width: anchoMax, height: anchoMax, fit: 'inside', withoutEnlargement: true })
      // El PDF solo incrusta JPEG sin recomprimir; WebP/PNG Chrome los reescribe sin pérdida
      // (más pesados). PNG solo si hay transparencia (logo, productos recortados).
      const { hasAlpha } = await imagen.metadata()
      const reducida = hasAlpha
        ? await imagen.png({ compressionLevel: 9, palette: true }).toBuffer()
        : await imagen.jpeg({ quality: 78, mozjpeg: true }).toBuffer()
      return `data:image/${hasAlpha ? 'png' : 'jpeg'};base64,${reducida.toString('base64')}`
    } catch {
      // Formato que sharp no entiende: usar la original si no es enorme
      return original.length <= 2 * 1024 * 1024 ? `data:${tipo};base64,${original.toString('base64')}` : null
    }
  } catch {
    return null // tiempo agotado o error de red
  }
}

/**
 * Devuelve la imagen como data URI lista para el PDF, o null si no se pudo obtener.
 * `anchoMax` en px: ~3× el tamaño impreso para que se vea nítida.
 */
export function imagenParaPDF(url: string | null | undefined, anchoMax: number): Promise<string | null> {
  if (!url) return Promise.resolve(null)
  if (url.startsWith('data:image/')) return Promise.resolve(url) // firma del cliente, ya viene incrustada
  if (!/^https?:\/\//i.test(url)) return Promise.resolve(null)

  const clave = `${anchoMax}|${url}`
  let pendiente = cache.get(clave)
  if (!pendiente) {
    pendiente = procesar(url, anchoMax)
    cache.set(clave, pendiente)
    // No guardar fallos: puede ser un problema temporal de red
    void pendiente.then((r) => { if (r === null) cache.delete(clave) })
    if (cache.size > MAX_EN_MEMORIA) cache.delete(cache.keys().next().value as string)
  }
  return pendiente
}

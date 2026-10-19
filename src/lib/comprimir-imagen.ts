// Compresión en el navegador antes de subir fotos (componentes cliente).
// Las fotos de celular llegan de 3–5 MB; a 1600 px y calidad 0.82 quedan en ~200–400 KB,
// suben mucho más rápido con datos móviles y aligeran los PDFs.

export async function comprimirImagen(file: File, ladoMax = 1600, calidad = 0.82): Promise<File> {
  // GIF (animación) y SVG se dejan tal cual; el servidor decide si los acepta
  if (!file.type.startsWith('image/') || /gif|svg/i.test(file.type)) return file

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height))

    // Ya es pequeña: no vale la pena recomprimir
    if (escala === 1 && file.size <= 400 * 1024) {
      bitmap.close()
      return file
    }

    const ancho = Math.round(bitmap.width * escala)
    const alto = Math.round(bitmap.height * escala)
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return file }

    // JPEG no tiene transparencia: fondo blanco para PNGs de producto
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    bitmap.close()

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', calidad))
    if (!blob || blob.size >= file.size) return file

    const nombre = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], nombre, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    // Formato que el navegador no puede decodificar (p. ej. HEIC en Chrome): subir la original
    return file
  }
}

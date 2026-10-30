// Tipo real de un archivo subido según su contenido (no según lo que dice el navegador)

export const MAX_BYTES_COMPROBANTE = 10 * 1024 * 1024 // las fotos llegan comprimidas (~300 KB); los PDF de factura son chicos

export function tipoReal(b: Buffer): { ext: string; mime: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' }
  if (b.toString('ascii', 0, 5) === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' }
  if (b.toString('ascii', 4, 8) === 'ftyp' && /^(heic|heix|mif1|msf1|hevc)$/.test(b.toString('ascii', 8, 12))) return { ext: 'heic', mime: 'image/heic' }
  return null
}

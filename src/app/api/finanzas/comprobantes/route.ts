import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireNivel } from '@/lib/auth'
import { hoyMexico, RUTA_COMPROBANTE } from '@/lib/finanzas'
import { esFinanzas } from '@/lib/finanzas-servidor'

// Fotos de tickets y facturas de los gastos. Se guardan en el bucket PRIVADO "documentos"
// y solo se ven con un enlace temporal: el dueño del gasto o administración/contabilidad.

const BUCKET = 'documentos'
const MAX_BYTES = 10 * 1024 * 1024 // las fotos llegan comprimidas (~300 KB); los PDF de factura son chicos

// Se revisa el contenido real del archivo, no solo lo que dice el navegador
function tipoReal(b: Buffer): { ext: string; mime: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' }
  if (b.toString('ascii', 0, 5) === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' }
  if (b.toString('ascii', 4, 8) === 'ftyp' && /^(heic|heix|mif1|msf1|hevc)$/.test(b.toString('ascii', 8, 12))) return { ext: 'heic', mime: 'image/heic' }
  return null
}

export async function POST(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth

  const form = await req.formData().catch(() => null)
  const archivo = form?.get('archivo')
  if (!(archivo instanceof File)) return NextResponse.json({ error: 'No llegó ningún archivo' }, { status: 400 })
  if (archivo.size > MAX_BYTES) return NextResponse.json({ error: 'El archivo pesa más de 10 MB' }, { status: 400 })

  const buffer = Buffer.from(await archivo.arrayBuffer())
  const tipo = tipoReal(buffer)
  if (!tipo) return NextResponse.json({ error: 'Solo se aceptan fotos (JPG, PNG, WEBP, HEIC) o PDF' }, { status: 400 })

  const ruta = `comprobantes/${auth.userId}/${hoyMexico().slice(0, 7)}/${randomUUID()}.${tipo.ext}`
  const { error } = await auth.supabase.storage.from(BUCKET).upload(ruta, buffer, { contentType: tipo.mime, upsert: false })
  if (error) return NextResponse.json({ error: 'No se pudo subir el archivo' }, { status: 500 })

  return NextResponse.json({ data: { ruta } }, { status: 201 })
}

/** Quita una foto que se subió pero no se llegó a guardar en ningún movimiento (al cancelar la captura) */
export async function DELETE(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth

  const ruta = req.nextUrl.searchParams.get('ruta') ?? ''
  if (!RUTA_COMPROBANTE.test(ruta) || !ruta.startsWith(`comprobantes/${auth.userId}/`)) {
    return NextResponse.json({ error: 'Comprobante inválido' }, { status: 400 })
  }
  const { count } = await auth.supabase.from('movimientos').select('id', { count: 'exact', head: true }).contains('comprobantes', [ruta])
  if (count) return NextResponse.json({ ok: true }) // ya pertenece a un movimiento: se borra junto con él
  await auth.supabase.storage.from(BUCKET).remove([ruta])
  return NextResponse.json({ ok: true })
}

/** Abre un comprobante: redirige a un enlace temporal de 5 minutos */
export async function GET(req: NextRequest) {
  const auth = await requireNivel()
  if (auth instanceof NextResponse) return auth

  const ruta = req.nextUrl.searchParams.get('ruta') ?? ''
  if (!RUTA_COMPROBANTE.test(ruta)) return NextResponse.json({ error: 'Comprobante inválido' }, { status: 400 })
  if (!esFinanzas(auth) && !ruta.startsWith(`comprobantes/${auth.userId}/`)) {
    return NextResponse.json({ error: 'No puedes ver este comprobante' }, { status: 403 })
  }

  const { data, error } = await auth.supabase.storage.from(BUCKET).createSignedUrl(ruta, 300)
  if (error || !data) return NextResponse.json({ error: 'No se encontró el comprobante' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}

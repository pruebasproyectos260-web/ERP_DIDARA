import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { hoyMexico } from '@/lib/finanzas'
import { MAX_BYTES_COMPROBANTE, tipoReal } from '@/lib/archivos'
import { RUTA_COMPROBANTE_TCG } from '@/lib/transportes'
import { soloSuperAdmin } from '@/lib/transportes-servidor'

// Archivos de Transportes (fotos de tickets y documentos de vehículos): bucket PRIVADO "documentos",
// carpeta tcg/ aparte de las de Didara. Solo el super admin los sube y los ve (con enlace temporal).

const BUCKET = 'documentos'

export async function POST(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const form = await req.formData().catch(() => null)
  const archivo = form?.get('archivo')
  if (!(archivo instanceof File)) return NextResponse.json({ error: 'No llegó ningún archivo' }, { status: 400 })
  if (archivo.size > MAX_BYTES_COMPROBANTE) return NextResponse.json({ error: 'El archivo pesa más de 10 MB' }, { status: 400 })

  const buffer = Buffer.from(await archivo.arrayBuffer())
  const tipo = tipoReal(buffer)
  if (!tipo) return NextResponse.json({ error: 'Solo se aceptan fotos (JPG, PNG, WEBP, HEIC) o PDF' }, { status: 400 })

  const ruta = `tcg/${hoyMexico().slice(0, 7)}/${randomUUID()}.${tipo.ext}`
  const { error } = await auth.supabase.storage.from(BUCKET).upload(ruta, buffer, { contentType: tipo.mime, upsert: false })
  if (error) return NextResponse.json({ error: 'No se pudo subir el archivo' }, { status: 500 })
  return NextResponse.json({ data: { ruta } }, { status: 201 })
}

/** Quita una foto que se subió pero no se llegó a guardar (al cancelar la captura) */
export async function DELETE(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const ruta = req.nextUrl.searchParams.get('ruta') ?? ''
  if (!RUTA_COMPROBANTE_TCG.test(ruta)) return NextResponse.json({ error: 'Comprobante inválido' }, { status: 400 })
  const [{ count: enGastos }, { count: enDocumentos }] = await Promise.all([
    auth.supabase.from('tcg_gastos').select('id', { count: 'exact', head: true }).contains('comprobantes', [ruta]),
    auth.supabase.from('tcg_documentos').select('id', { count: 'exact', head: true }).contains('archivos', [ruta]),
  ])
  if (enGastos || enDocumentos) return NextResponse.json({ ok: true }) // ya pertenece a un gasto o documento: se borra junto con él
  await auth.supabase.storage.from(BUCKET).remove([ruta])
  return NextResponse.json({ ok: true })
}

/** Abre un comprobante: redirige a un enlace temporal de 5 minutos */
export async function GET(req: NextRequest) {
  const auth = await soloSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const ruta = req.nextUrl.searchParams.get('ruta') ?? ''
  if (!RUTA_COMPROBANTE_TCG.test(ruta)) return NextResponse.json({ error: 'Comprobante inválido' }, { status: 400 })
  const { data, error } = await auth.supabase.storage.from(BUCKET).createSignedUrl(ruta, 300)
  if (error || !data) return NextResponse.json({ error: 'No se encontró el comprobante' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}

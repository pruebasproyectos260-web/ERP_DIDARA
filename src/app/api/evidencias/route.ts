import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { leerJson } from '@/lib/campos'
import { MAX_BYTES_IMAGEN, esImagenPermitida, extensionDeMime, segmentoSeguro } from '@/lib/imagenes'

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { data, mimeType, nombre, sesion, tipo } = await leerJson(req)

  if (typeof data !== 'string' || !data || !mimeType) {
    return NextResponse.json({ error: 'Se requiere data y mimeType' }, { status: 400 })
  }
  if (!esImagenPermitida(mimeType)) {
    return NextResponse.json({ error: 'Solo se permiten imágenes (JPG, PNG, WEBP...)' }, { status: 400 })
  }

  const buffer = Buffer.from(data, 'base64')
  if (buffer.length > MAX_BYTES_IMAGEN) {
    return NextResponse.json({ error: 'La imagen no puede pesar más de 15 MB' }, { status: 400 })
  }

  const safeName = segmentoSeguro(typeof nombre === 'string' ? nombre.replace(/\.[^.]+$/, '') : '', 'foto')
  const folder = `${segmentoSeguro(sesion, 'sin_sesion')}/${segmentoSeguro(tipo, 'otro')}`
  const filePath = `${folder}/${Date.now()}_${safeName}.${extensionDeMime(mimeType)}`

  const { error } = await supabase.storage
    .from('evidencias')
    .upload(filePath, buffer, { contentType: mimeType, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from('evidencias')
    .getPublicUrl(filePath)

  return NextResponse.json({ url: publicUrl, path: filePath })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth
  const { url } = await leerJson(req)

  if (typeof url !== 'string' || !url) return NextResponse.json({ error: 'Se requiere url' }, { status: 400 })

  const marker = '/storage/v1/object/public/evidencias/'
  const idx = url.indexOf(marker)
  if (idx < 0) {
    // URL externa (ej. Google Drive) — nada que borrar en Storage
    return NextResponse.json({ ok: true })
  }

  const path = url.slice(idx + marker.length)
  const { error } = await supabase.storage.from('evidencias').remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { MAX_BYTES_IMAGEN, esImagenPermitida, extensionDeMime } from '@/lib/imagenes'

export async function POST(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ESTANDAR)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
  if (!esImagenPermitida(file.type)) {
    return NextResponse.json({ error: 'Solo se permiten imágenes (JPG, PNG, WEBP...)' }, { status: 400 })
  }
  if (file.size > MAX_BYTES_IMAGEN) {
    return NextResponse.json({ error: 'La imagen no puede pesar más de 15 MB' }, { status: 400 })
  }

  const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionDeMime(file.type)}`

  const buffer = Buffer.from(await file.arrayBuffer())

  const { data, error } = await supabase.storage
    .from('productos')
    .upload(nombre, buffer, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from('productos')
    .getPublicUrl(data.path)

  return NextResponse.json({ url: publicUrl })
}

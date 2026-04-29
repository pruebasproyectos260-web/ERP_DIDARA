import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const { data, mimeType, nombre, sesion, tipo } = await req.json()

  if (!data || !mimeType) {
    return NextResponse.json({ error: 'Se requiere data y mimeType' }, { status: 400 })
  }

  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
  const safeName = (nombre ?? 'foto').replace(/[^a-z0-9._-]/gi, '_')
  const folder = sesion
    ? `${sesion}/${tipo ?? 'otro'}`
    : `sin_sesion/${tipo ?? 'otro'}`
  const filePath = `${folder}/${Date.now()}_${safeName}.${ext}`

  const buffer = Buffer.from(data, 'base64')

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
  const supabase = createServiceClient()
  const { url } = await req.json()

  if (!url) return NextResponse.json({ error: 'Se requiere url' }, { status: 400 })

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

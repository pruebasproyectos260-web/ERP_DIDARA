import { NextRequest, NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { registrarActividad } from '@/lib/actividad'
import { faltaMigracion } from '@/lib/tickets'

// Administración: qué dispositivos reciben los avisos de cada persona.
// Un dispositivo es de quien activó los avisos con su sesión (ver /api/push).

export async function GET() {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth

  const [{ data, error }, { data: usuarios }] = await Promise.all([
    auth.supabase.from('push_suscripciones').select('id, usuario_id, dispositivo, created_at').order('created_at', { ascending: false }),
    auth.supabase.from('usuarios').select('id, nombre'),
  ])
  if (error) {
    if (faltaMigracion(error)) return NextResponse.json({ data: [] })
    return NextResponse.json({ error: 'No se pudieron cargar los dispositivos' }, { status: 500 })
  }
  const nombre = new Map((usuarios ?? []).map((u) => [u.id, u.nombre as string]))
  return NextResponse.json({
    data: (data ?? []).map((d) => ({ ...d, usuario: nombre.get(d.usuario_id)?.trim() ?? 'Usuario eliminado' })),
  })
}

/** Quitar un dispositivo: deja de recibir avisos hasta que su dueño los vuelva a activar */
export async function DELETE(req: NextRequest) {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth

  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Dispositivo inválido' }, { status: 400 })
  const { data: borrados, error } = await auth.supabase.from('push_suscripciones').delete().eq('id', id).select('usuario_id, dispositivo')
  if (error) return NextResponse.json({ error: 'No se pudo quitar' }, { status: 500 })
  if (borrados?.length) await registrarActividad(auth, 'eliminar', 'push_suscripciones', id, `Quitó avisos de ${borrados[0].dispositivo ?? 'un dispositivo'}`)
  return NextResponse.json({ ok: true })
}

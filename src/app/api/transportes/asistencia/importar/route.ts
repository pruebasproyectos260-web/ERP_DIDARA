import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { errorValidacion, leerJson } from '@/lib/campos'
import { esquemaImportarActividad } from '@/lib/transportes'
import { tokenAsistenciaValido } from '@/lib/transportes-servidor'

// La Raspberry de casa (que tiene copia de TALONES y REMI) manda cada noche quién trabajó cada día.
// No usa sesión: se identifica con "Authorization: Bearer <tokenAsistencia()>". Ver scripts/asistencia_tcg.py.

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!tokenAsistenciaValido(token)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const parsed = esquemaImportarActividad.safeParse(await leerJson(req))
  if (!parsed.success) return errorValidacion(parsed.error)
  const { dias } = parsed.data
  // Un renglón por (fecha, usuario) aunque vengan repetidos
  const unidos = new Map<string, (typeof parsed.data.registros)[number]>()
  for (const r of parsed.data.registros) {
    const previo = unidos.get(`${r.fecha}|${r.usuario}`)
    unidos.set(`${r.fecha}|${r.usuario}`, previo
      ? { ...previo, documentos: previo.documentos + r.documentos, fuentes: [...new Set([...previo.fuentes, ...r.fuentes])] }
      : r)
  }
  const registros = [...unidos.values()]
  const supabase = createServiceClient()
  const ahora = new Date().toISOString()

  // Días: solo el conteo; la decisión a mano ("estado") se conserva
  if (dias.length) {
    const { error } = await supabase.from('tcg_dias')
      .upsert(dias.map((d) => ({ ...d, actualizado_at: ahora })), { onConflict: 'fecha', ignoreDuplicates: false })
    if (error) return NextResponse.json({ error: 'No se pudieron guardar los días' }, { status: 500 })
  }

  // Lo de cada usuario en esas fechas se reemplaza completo (si un documento se canceló, deja de contar)
  const fechas = [...new Set([...dias.map((d) => d.fecha), ...registros.map((r) => r.fecha)])]
  if (fechas.length) {
    const { error } = await supabase.from('tcg_actividad').delete().in('fecha', fechas)
    if (error) return NextResponse.json({ error: 'No se pudo actualizar la actividad' }, { status: 500 })
  }
  if (registros.length) {
    const { error } = await supabase.from('tcg_actividad').insert(registros.map((r) => ({ ...r, actualizado_at: ahora })))
    if (error) return NextResponse.json({ error: 'No se pudo guardar la actividad' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, dias: dias.length, registros: registros.length })
}

import { createServiceClient } from '@/lib/supabase/server'
import type { Sesion } from '@/lib/auth'

// Registro de actividad (tabla `actividad`, ver supabase/migracion_actividad.sql).
// Nunca debe romper la operación principal: si la tabla no existe o falla, se ignora.

export type Accion =
  | 'crear' | 'editar' | 'eliminar' | 'cambiar_estado' | 'firmar'
  | 'desactivar' | 'cambiar_contrasena' | 'respaldo'
  | 'revisar' | 'registrar_pago'

export async function registrarActividad(
  // userId null = acción de un cliente desde un enlace público (firma, portal de soporte)
  sesion: Pick<Sesion, 'nombre'> & { userId: string | null } | null,
  accion: Accion,
  tabla: string,
  registroId: string | number | null | undefined,
  detalle?: string,
): Promise<void> {
  try {
    await createServiceClient().from('actividad').insert({
      usuario_id: sesion?.userId ?? null,
      usuario_nombre: sesion?.nombre ?? 'Cliente (firma en línea)',
      accion,
      tabla,
      registro_id: registroId === null || registroId === undefined ? null : String(registroId),
      detalle: detalle?.slice(0, 500) ?? null,
    })
  } catch {
    // silencioso
  }
}

/** Resume qué campos cambiaron, para el detalle del registro. */
export function camposCambiados(body: Record<string, unknown>): string {
  const campos = Object.keys(body)
  return campos.length ? `Campos: ${campos.join(', ')}` : ''
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient, createServiceClient, usuarioDeSesion } from '@/lib/supabase/server'
import { NIVEL } from '@/lib/nivel'
import { faltaMigracionTCG, NOMBRE_TCG } from '@/lib/transportes'

export const dynamic = 'force-dynamic'

// Transportes de Carga General Vicente Guerrero: solo el super admin. Para cualquier otro
// nivel la sección "no existe" (404), ni siquiera se sabe que está aquí.

async function esSuperAdmin() {
  const supabase = await createClient()
  const user = await usuarioDeSesion(supabase)
  if (!user) return false
  const { data: perfil } = await supabase.from('usuarios').select('nivel').eq('id', user.id).single()
  return perfil?.nivel === NIVEL.SUPER_ADMIN
}

// El título de la pestaña se resuelve aparte de la página: también se esconde a otros niveles
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await esSuperAdmin()) ? 'Transportes' : '404' }
}

export default async function TransportesLayout({ children }: { children: React.ReactNode }) {
  const [permitido, { error }] = await Promise.all([
    esSuperAdmin(),
    createServiceClient().from('tcg_empleados').select('id', { count: 'exact', head: true }),
  ])
  if (!permitido) notFound()

  if (error && faltaMigracionTCG(error)) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Falta activar Transportes</h2>
        <p className="mt-2 text-sm text-gray-600">
          Corre una vez el archivo <code className="rounded bg-gray-100 px-1.5 py-0.5">supabase/migracion_transportes.sql</code> en
          Supabase → SQL Editor y vuelve a cargar esta página.
        </p>
        <p className="mt-3 text-xs text-gray-400">{NOMBRE_TCG}</p>
      </div>
    )
  }
  return children
}

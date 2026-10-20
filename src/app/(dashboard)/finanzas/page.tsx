import type { Metadata } from 'next'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { faltaMigracionFinanzas, veFinanzas } from '@/lib/finanzas'
import FinanzasClient from './FinanzasClient'

export const metadata: Metadata = { title: 'Finanzas' }
export const dynamic = 'force-dynamic'

const VISTAS = ['resumen', 'movimientos', 'fijos', 'cobranza', 'contabilidad'] as const

export default async function FinanzasPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  const { data: perfil } = await authClient.from('usuarios').select('nivel, es_contador').eq('id', user!.id).single()
  const completo = veFinanzas(perfil?.nivel ?? 3, perfil?.es_contador ?? false)

  // movimientos no tiene políticas RLS: se lee con service role tras validar la sesión
  const supabase = createServiceClient()
  const [{ error }, { data: clientes }] = await Promise.all([
    supabase.from('movimientos').select('id', { count: 'exact', head: true }),
    completo
      ? supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre')
      : Promise.resolve({ data: [] as { id: number; nombre: string }[] }),
  ])

  if (error && faltaMigracionFinanzas(error)) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Falta activar Finanzas</h2>
        <p className="mt-2 text-sm text-gray-600">
          Corre una vez el archivo <code className="rounded bg-gray-100 px-1.5 py-0.5">supabase/migracion_finanzas.sql</code> en
          Supabase → SQL Editor y vuelve a cargar esta página.
        </p>
      </div>
    )
  }

  return (
    <FinanzasClient
      completo={completo}
      clientes={clientes ?? []}
      vistaInicial={VISTAS.find((v) => v === vista) ?? 'resumen'}
    />
  )
}

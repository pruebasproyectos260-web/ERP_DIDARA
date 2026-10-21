import type { Metadata } from 'next'
import { createClient, createServiceClient, usuarioDeSesion } from '@/lib/supabase/server'
import { faltaMigracion } from '@/lib/tickets'
import TicketsClient from './TicketsClient'

export const metadata: Metadata = { title: 'Mesa de ayuda' }
export const dynamic = 'force-dynamic'

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams
  const authClient = await createClient()
  const user = await usuarioDeSesion(authClient)
  const { data: perfil } = await authClient.from('usuarios').select('nivel').eq('id', user!.id).single()

  // tickets no tiene políticas RLS: se lee con service role tras validar la sesión
  const supabase = createServiceClient()
  const [{ data: tickets, error }, { data: usuarios }, { data: clientes }] = await Promise.all([
    supabase.from('tickets').select('*, cliente:clientes(id, nombre)').order('created_at', { ascending: false }),
    supabase.from('usuarios').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('clientes').select('id, nombre, email').eq('activo', true).order('nombre'),
  ])

  if (error && faltaMigracion(error)) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Falta activar la mesa de ayuda</h2>
        <p className="mt-2 text-sm text-gray-600">
          Corre una vez el archivo <code className="rounded bg-gray-100 px-1.5 py-0.5">supabase/migracion_tickets.sql</code> en
          Supabase → SQL Editor y vuelve a cargar esta página.
        </p>
      </div>
    )
  }

  return (
    <TicketsClient
      ticketsIniciales={tickets ?? []}
      usuarios={usuarios ?? []}
      clientes={clientes ?? []}
      nivel={perfil?.nivel ?? 2}
      userId={user!.id}
      verInicial={ver ? Number(ver) : null}
    />
  )
}

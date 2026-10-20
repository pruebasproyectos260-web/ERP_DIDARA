import { redirect } from 'next/navigation'

// Gastos ahora vive en Finanzas (supabase/migracion_finanzas.sql copió los datos)
export default function GastosPage() {
  redirect('/finanzas?vista=movimientos')
}

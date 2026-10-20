import { redirect } from 'next/navigation'

// Ventas ahora vive en Finanzas (resumen, movimientos y cobranza)
export default function VentasPage() {
  redirect('/finanzas')
}

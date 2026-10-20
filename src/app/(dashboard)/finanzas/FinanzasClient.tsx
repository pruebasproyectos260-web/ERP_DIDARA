'use client'

import { useState } from 'react'
import { Calculator, CalendarCheck, HandCoins, LayoutGrid, ListOrdered } from 'lucide-react'
import { EncabezadoPagina } from '@/components/ui/Pagina'
import { mesActual } from '@/lib/finanzas'
import Resumen, { type Vista } from '@/components/finanzas/Resumen'
import Movimientos from '@/components/finanzas/Movimientos'
import Fijos from '@/components/finanzas/Fijos'
import Cobranza from '@/components/finanzas/Cobranza'
import Contabilidad from '@/components/finanzas/Contabilidad'

const PESTANAS: { vista: Vista; label: string; icono: React.ComponentType<{ size?: number }> }[] = [
  { vista: 'resumen', label: 'Resumen', icono: LayoutGrid },
  { vista: 'movimientos', label: 'Movimientos', icono: ListOrdered },
  { vista: 'fijos', label: 'Fijos del mes', icono: CalendarCheck },
  { vista: 'cobranza', label: 'Cobranza', icono: HandCoins },
  { vista: 'contabilidad', label: 'Contabilidad', icono: Calculator },
]

export default function FinanzasClient({ completo, clientes, vistaInicial }: {
  completo: boolean
  clientes: { id: number; nombre: string }[]
  vistaInicial: Vista
}) {
  const [vista, setVista] = useState<Vista>(vistaInicial)
  const [mes, setMes] = useState(mesActual())
  const [porRevisar, setPorRevisar] = useState(false)

  // Equipo de campo: solo registra y consulta sus propios gastos
  if (!completo) {
    return (
      <div className="space-y-5">
        <EncabezadoPagina titulo="Mis gastos" subtitulo="Registra gasolina, casetas, comida o material con foto del ticket" />
        <Movimientos completo={false} mes={mes} onMes={setMes} />
      </div>
    )
  }

  function ir(v: Vista, opciones?: { porRevisar?: boolean }) {
    setPorRevisar(!!opciones?.porRevisar)
    setVista(v)
    // La pestaña queda en la dirección (al recargar o compartir el enlace se abre la misma)
    window.history.replaceState(null, '', v === 'resumen' ? '/finanzas' : `/finanzas?vista=${v}`)
  }

  return (
    <div className="space-y-5">
      <EncabezadoPagina titulo="Finanzas" subtitulo="Lo que entra, lo que sale y lo que está pendiente" />

      <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Secciones de finanzas">
        <div className="inline-flex min-w-full gap-1 border-b border-gray-200 sm:min-w-0">
          {PESTANAS.map(({ vista: v, label, icono: Icono }) => (
            <button key={v} onClick={() => ir(v)} aria-current={vista === v ? 'page' : undefined}
              className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${vista === v
                ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              <Icono size={16} /> {label}
            </button>
          ))}
        </div>
      </nav>

      {vista === 'resumen' && <Resumen mes={mes} onMes={setMes} onIr={ir} />}
      {vista === 'movimientos' && (
        <Movimientos key={porRevisar ? 'revisar' : 'mes'} completo clientes={clientes} mes={mes} onMes={setMes} porRevisarInicial={porRevisar} />
      )}
      {vista === 'fijos' && <Fijos mes={mes} onMes={setMes} clientes={clientes} />}
      {vista === 'cobranza' && <Cobranza />}
      {vista === 'contabilidad' && <Contabilidad mes={mes} onMes={setMes} />}
    </div>
  )
}

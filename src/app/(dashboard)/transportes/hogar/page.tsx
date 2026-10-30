import GastosTCG from '@/components/transportes/GastosTCG'

// Sin "metadata" propia: el título lo pone el layout solo para el super admin
export default function GastosHogarPage() {
  return <GastosTCG ambito="hogar" />
}

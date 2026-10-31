import VehiculosTCG from '@/components/transportes/VehiculosTCG'

// Carros de la familia: igual que camiones, pero sus gastos van a Gastos del hogar
export default async function CarrosPage({ searchParams }: { searchParams: Promise<{ camion?: string }> }) {
  const { camion } = await searchParams
  return <VehiculosTCG uso="familia" vehiculoInicial={Number(camion) > 0 ? Number(camion) : null} />
}

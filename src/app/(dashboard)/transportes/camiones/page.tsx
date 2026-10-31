import VehiculosTCG from '@/components/transportes/VehiculosTCG'

// Sin "metadata" propia: el título lo pone el layout solo para el super admin
export default async function CamionesPage({ searchParams }: { searchParams: Promise<{ camion?: string }> }) {
  const { camion } = await searchParams
  return <VehiculosTCG uso="empresa" vehiculoInicial={Number(camion) > 0 ? Number(camion) : null} />
}

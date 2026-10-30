import CamionesTCG from '@/components/transportes/CamionesTCG'

// Sin "metadata" propia: el título lo pone el layout solo para el super admin
export default async function CamionesPage({ searchParams }: { searchParams: Promise<{ camion?: string }> }) {
  const { camion } = await searchParams
  return <CamionesTCG camionInicial={Number(camion) > 0 ? Number(camion) : null} />
}

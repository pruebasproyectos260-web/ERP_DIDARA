import { NextResponse } from 'next/server'
import { requireNivel } from '@/lib/auth'
import { NIVEL } from '@/lib/nivel'
import { registrarActividad } from '@/lib/actividad'

// Respaldo completo de la base de datos en un archivo JSON (una llave por tabla).
// No incluye los archivos de Storage (fotos, logo): esos ya viven como URLs públicas.

export const maxDuration = 60

const TABLAS = [
  'configuracion', 'usuarios', 'clientes', 'productos',
  'cotizaciones', 'cotizacion_items', 'reportes', 'reporte_items',
  'eventos', 'pendientes', 'software',
  'gastos_fijos', 'gastos_fijos_registros', 'gastos_variables',
  'ganancias_fijas', 'ganancias_fijas_registros', 'ingresos_manuales',
  'ventas', 'gastos', 'actividad',
]

const POR_PAGINA = 1000

export async function GET() {
  const auth = await requireNivel(NIVEL.ADMIN)
  if (auth instanceof NextResponse) return auth
  const { supabase } = auth

  const tablas: Record<string, unknown[]> = {}
  const omitidas: string[] = []

  for (const tabla of TABLAS) {
    const filas: unknown[] = []
    for (let desde = 0; ; desde += POR_PAGINA) {
      const { data, error } = await supabase
        .from(tabla)
        .select('*')
        .order('id', { ascending: true })
        .range(desde, desde + POR_PAGINA - 1)
      if (error) { omitidas.push(`${tabla}: ${error.message}`); break }
      filas.push(...(data ?? []))
      if (!data || data.length < POR_PAGINA) break
    }
    tablas[tabla] = filas
  }

  const fecha = new Date().toISOString().slice(0, 10)
  const respaldo = {
    generado: new Date().toISOString(),
    generado_por: auth.nombre,
    conteo: Object.fromEntries(Object.entries(tablas).map(([t, f]) => [t, f.length])),
    omitidas,
    tablas,
  }

  await registrarActividad(auth, 'respaldo', 'sistema', null,
    `Respaldo descargado (${Object.values(respaldo.conteo).reduce((a, b) => a + b, 0)} registros)`)

  return new NextResponse(JSON.stringify(respaldo), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="respaldo-didara-${fecha}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, History, Loader2, RefreshCw } from 'lucide-react'
import { aviso } from '@/components/ui/Avisos'

interface Registro {
  id: number
  created_at: string
  usuario_nombre: string | null
  accion: string
  tabla: string
  registro_id: string | null
  detalle: string | null
}

const TABLAS: { valor: string; label: string }[] = [
  { valor: '',                  label: 'Todo' },
  { valor: 'cotizaciones',      label: 'Cotizaciones' },
  { valor: 'reportes',          label: 'Reportes' },
  { valor: 'clientes',          label: 'Clientes' },
  { valor: 'productos',         label: 'Inventario' },
  { valor: 'gastos_fijos',      label: 'Gastos fijos' },
  { valor: 'gastos_variables',  label: 'Gastos variables' },
  { valor: 'ingresos_manuales', label: 'Ingresos' },
  { valor: 'ganancias_fijas',   label: 'Ganancias fijas' },
  { valor: 'usuarios',          label: 'Usuarios' },
  { valor: 'configuracion',     label: 'Configuración' },
  { valor: 'software',          label: 'Software' },
  { valor: 'sistema',           label: 'Respaldos' },
]

const ETIQUETA_TABLA = Object.fromEntries(TABLAS.filter((t) => t.valor).map((t) => [t.valor, t.label]))

const ACCIONES: Record<string, { label: string; cls: string }> = {
  crear:              { label: 'Creó',            cls: 'bg-green-100 text-green-700' },
  editar:             { label: 'Editó',           cls: 'bg-brand-100 text-brand-700' },
  eliminar:           { label: 'Eliminó',         cls: 'bg-red-100 text-red-700' },
  cambiar_estado:     { label: 'Cambió estado',   cls: 'bg-amber-100 text-amber-800' },
  firmar:             { label: 'Firmó',           cls: 'bg-purple-100 text-purple-700' },
  desactivar:         { label: 'Desactivó',       cls: 'bg-red-100 text-red-700' },
  cambiar_contrasena: { label: 'Contraseña',      cls: 'bg-gray-100 text-gray-700' },
  respaldo:           { label: 'Respaldo',        cls: 'bg-teal-100 text-teal-700' },
}

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ActividadPanel() {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [tabla, setTabla] = useState('')
  const [cargando, setCargando] = useState(true)
  const [pendiente, setPendiente] = useState(false)
  const [error, setError] = useState('')
  const [descargando, setDescargando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  // El estado de "cargando" se activa en los handlers; el efecto solo sincroniza con la API
  useEffect(() => {
    let cancelado = false
    fetch(`/api/admin/actividad?tabla=${encodeURIComponent(tabla)}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'No se pudo cargar la actividad')
        if (cancelado) return
        setRegistros(json.data ?? [])
        setPendiente(Boolean(json.pendiente))
        setError('')
      })
      .catch((err) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudo cargar la actividad') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [tabla, recarga])

  const recargar = useCallback(() => { setCargando(true); setRecarga((n) => n + 1) }, [])
  const cambiarTabla = (valor: string) => { setCargando(true); setTabla(valor) }

  async function descargarRespaldo() {
    setDescargando(true)
    try {
      const res = await fetch('/api/admin/respaldo')
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'No se pudo generar el respaldo')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `respaldo-didara-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      aviso.exito('Respaldo descargado')
      recargar()
    } catch (err) {
      aviso.error(err instanceof Error ? err.message : 'No se pudo generar el respaldo')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Respaldo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Respaldo de la base de datos</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Descarga todos los clientes, cotizaciones, reportes, inventario, gastos y usuarios en un archivo.
            El plan gratuito de Supabase no guarda respaldos automáticos: conviene descargar uno cada semana.
          </p>
        </div>
        <button
          onClick={descargarRespaldo}
          disabled={descargando}
          className="shrink-0 flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {descargando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {descargando ? 'Generando…' : 'Descargar respaldo'}
        </button>
      </div>

      {/* Actividad */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <History size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900">Registro de actividad</h2>
          </div>
          <div className="flex items-center gap-2">
            <select value={tabla} onChange={(e) => cambiarTabla(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white">
              {TABLAS.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
            <button onClick={recargar} disabled={cargando} title="Actualizar"
              className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
              <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {pendiente ? (
          <div className="px-5 py-8 text-sm text-gray-600">
            Falta crear la tabla de actividad. Corre <code className="bg-gray-100 px-1.5 py-0.5 rounded">supabase/migracion_actividad.sql</code> en
            Supabase → SQL Editor y vuelve a cargar esta pestaña.
          </div>
        ) : error ? (
          <p className="px-5 py-8 text-sm text-red-600">{error}</p>
        ) : cargando && registros.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400">Cargando…</p>
        ) : registros.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">Aún no hay actividad registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Usuario</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Acción</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Módulo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registros.map((r) => {
                  const accion = ACCIONES[r.accion] ?? { label: r.accion, cls: 'bg-gray-100 text-gray-700' }
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fechaHora(r.created_at)}</td>
                      <td className="px-4 py-2.5 text-gray-800 whitespace-nowrap">{r.usuario_nombre ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${accion.cls}`}>{accion.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{ETIQUETA_TABLA[r.tabla] ?? r.tabla}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-700">{r.detalle ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

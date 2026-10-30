'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarX2, ChevronLeft, ChevronRight, Gift, Info, Loader2, Pencil, Plus, RefreshCw, Trash2, Users, X } from 'lucide-react'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { EncabezadoPagina } from '@/components/ui/Pagina'
import { formatoMoneda, hoyMexico, nombreMes, rangoMes } from '@/lib/finanzas'
import {
  DIAS_AGUINALDO, ETIQUETA_ESTADO, esLaborable, estadoOficina, festivos, resumenAnio,
  type DiaOficina, type EmpleadoTCG, type EstadoDia, type EstadoManual, type ResumenAnio,
} from '@/lib/transportes'
import { claseCampo, HojaCaptura, Interruptor, leerNumero } from './comunes'

interface Datos {
  empleados: EmpleadoTCG[]
  actividad: { fecha: string; usuario: string; documentos: number; fuentes: string[] }[]
  dias: { fecha: string; documentos: number | null; estado: 'laborable' | 'cerrado' | null; nota: string | null }[]
  marcas: { empleado_id: number; fecha: string; estado: EstadoManual; nota: string | null }[]
  usuarios: string[]
  ultimaLectura: string | null
}

/** Cómo se pinta cada estado en el calendario */
const CELDA: Record<EstadoDia, { cls: string; letra: string }> = {
  registro: { cls: 'bg-emerald-500 text-white', letra: '✓' },
  asistio: { cls: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-400', letra: 'A' },
  sin_registro: { cls: 'bg-amber-100 text-amber-800', letra: '?' },
  falta: { cls: 'bg-red-500 text-white', letra: 'F' },
  permiso: { cls: 'bg-gray-400 text-white', letra: 'P' },
  vacaciones: { cls: 'bg-sky-500 text-white', letra: 'V' },
  futuro: { cls: 'bg-white ring-1 ring-inset ring-gray-200', letra: '' },
  cerrado: { cls: 'bg-gray-100 text-gray-400', letra: '–' },
  no_laborable: { cls: 'bg-gray-50 text-gray-300', letra: '' },
  fuera: { cls: '', letra: '' },
}
const LEYENDA: EstadoDia[] = ['registro', 'sin_registro', 'asistio', 'falta', 'permiso', 'vacaciones', 'cerrado', 'no_laborable']
const LETRA_DIA = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

const fechaLarga = (f: string) => {
  const t = new Date(`${f}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function haceCuanto(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (min < 60) return `hace ${Math.max(min, 1)} min`
  if (min < 48 * 60) return `hace ${Math.round(min / 60)} h`
  return `hace ${Math.round(min / 1440)} días`
}

export default function AsistenciaTCG() {
  const hoy = hoyMexico()
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)))
  const [mes, setMes] = useState(hoy.slice(0, 7))
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [recarga, setRecarga] = useState(0)
  const [celda, setCelda] = useState<{ e: EmpleadoTCG; fecha: string } | null>(null)
  const [diaSel, setDiaSel] = useState<string | null>(null)
  const [empleados, setEmpleados] = useState(false)
  const [verRevisar, setVerRevisar] = useState(false)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/transportes/asistencia?anio=${anio}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelado) setDatos(j.data ?? null) })
      .catch(() => { if (!cancelado) aviso.error('No se pudo cargar la asistencia') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [anio, recarga])

  const recargar = useCallback(() => setRecarga((n) => n + 1), [])

  const oficina = useMemo(() => new Map<string, DiaOficina>((datos?.dias ?? []).map((d) => [d.fecha, { documentos: d.documentos, estado: d.estado }])), [datos])
  const feriados = useMemo(() => festivos(anio), [anio])

  const resumenes = useMemo(() => {
    const m = new Map<number, ResumenAnio>()
    for (const e of datos?.empleados ?? []) {
      const usuario = e.usuario_sistema?.toUpperCase()
      const conActividad = new Set((datos?.actividad ?? []).filter((a) => usuario && a.usuario === usuario).map((a) => a.fecha))
      const manual = new Map((datos?.marcas ?? []).filter((x) => x.empleado_id === e.id).map((x) => [x.fecha, x.estado]))
      m.set(e.id, resumenAnio(e, anio, conActividad, manual, oficina, hoy))
    }
    return m
  }, [datos, anio, oficina, hoy])

  // Días de la oficina que conviene revisar (hasta hoy): muy poco movimiento, o ninguno en día hábil
  const porRevisar = useMemo(() => {
    const lista: { fecha: string; documentos: number; tipo: 'poco' | 'nada' }[] = []
    for (const d of datos?.dias ?? []) {
      // Hoy todavía no termina: no se revisa
      if (d.estado || d.documentos == null || d.fecha >= hoy || !esLaborable(d.fecha, feriados)) continue
      const est = estadoOficina(d.fecha, { documentos: d.documentos, estado: null }, feriados)
      if (est === 'revisar') lista.push({ fecha: d.fecha, documentos: d.documentos, tipo: 'poco' })
      else if (est === 'cerrado') lista.push({ fecha: d.fecha, documentos: 0, tipo: 'nada' })
    }
    return lista.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [datos, hoy, feriados])

  async function marcarDia(fecha: string, estado: 'laborable' | 'cerrado' | null) {
    const r = await fetch('/api/transportes/asistencia/dia', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fecha, estado }) })
    if (!r.ok) return aviso.error('No se pudo guardar')
    setDatos((d) => {
      if (!d) return d
      const existe = d.dias.some((x) => x.fecha === fecha)
      return { ...d, dias: existe ? d.dias.map((x) => (x.fecha === fecha ? { ...x, estado } : x)) : [...d.dias, { fecha, documentos: null, estado, nota: null }] }
    })
  }

  async function marcarEmpleado(e: EmpleadoTCG, fecha: string, estado: EstadoManual | null) {
    const r = await fetch('/api/transportes/asistencia', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empleado_id: e.id, fecha, estado }) })
    if (!r.ok) return aviso.error('No se pudo guardar')
    setDatos((d) => d && {
      ...d,
      marcas: [...d.marcas.filter((x) => !(x.empleado_id === e.id && x.fecha === fecha)), ...(estado ? [{ empleado_id: e.id, fecha, estado, nota: null }] : [])],
    })
  }

  const anioActual = Number(hoy.slice(0, 4))
  // Los que trabajaron en algún momento de ese año
  const activos = (datos?.empleados ?? []).filter((e) =>
    (e.activo || (e.fecha_baja ?? '') >= `${anio}-01-01`) && (!e.fecha_ingreso || e.fecha_ingreso <= `${anio}-12-31`))
  const { dias: diasMes } = rangoMes(mes)
  const fechasMes = Array.from({ length: diasMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)

  function cambiarAnio(n: number) {
    setCargando(true)
    setAnio(n)
    setMes(n === anioActual ? hoy.slice(0, 7) : `${n}-12`)
  }
  function moverMes(delta: number) {
    const [a, m] = mes.split('-').map(Number)
    const nuevo = new Date(a, m - 1 + delta, 1)
    if (nuevo.getFullYear() !== anio) return
    setMes(`${anio}-${String(nuevo.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Asistencia y aguinaldo"
        subtitulo="Se toma sola de TALONES y REMI: si alguien hizo un talón, remisión, relación o movimiento de caja, asistió"
        acciones={
          <>
            <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-1">
              <button type="button" onClick={() => cambiarAnio(anio - 1)} aria-label="Año anterior" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><ChevronLeft size={18} /></button>
              <span className="min-w-[3.5rem] text-center text-sm font-semibold text-gray-900">{anio}</span>
              <button type="button" onClick={() => cambiarAnio(anio + 1)} disabled={anio >= anioActual} aria-label="Año siguiente" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={18} /></button>
            </div>
            <button onClick={() => setEmpleados(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Users size={16} /> Empleados
            </button>
          </>
        }
      />

      {cargando || !datos ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : (
        <>
          {/* De dónde salen los datos */}
          <p className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs ${datos.ultimaLectura ? 'bg-gray-50 text-gray-600' : 'bg-amber-50 text-amber-800'}`}>
            <RefreshCw size={14} className="mt-px shrink-0" />
            {datos.ultimaLectura
              ? <>Última lectura de TALONES/REMI: {haceCuanto(datos.ultimaLectura)}. Se actualiza sola cada noche.</>
              : <>Todavía no llega ninguna lectura de TALONES/REMI: mientras tanto todos los días cuentan como asistidos.</>}
          </p>

          {/* Resumen por empleado */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activos.map((e) => {
              const r = resumenes.get(e.id)!
              return (
                <div key={e.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{e.nombre}</p>
                      <p className="text-xs text-gray-500">
                        {e.usuario_sistema ? <>En el sistema: <span className="font-medium">{e.usuario_sistema}</span></> : 'Exento: presente salvo falta'}
                        {' · '}{formatoMoneda(e.sueldo_semanal)}/sem
                      </p>
                    </div>
                    {!e.activo && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">De baja</span>}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Dato titulo="Asistió" valor={`${r.asistidosHoy}/${r.habilesHoy}`} cls="text-gray-900" />
                    <Dato titulo="Faltas" valor={String(r.faltas + r.permisos)} cls={r.faltas + r.permisos ? 'text-red-600' : 'text-gray-900'} />
                    <Dato titulo="Sin registro" valor={String(r.sinRegistro)} cls={r.sinRegistro ? 'text-amber-700' : 'text-gray-900'} />
                  </div>
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-brand-50 px-3 py-2.5">
                    <Gift size={20} className="shrink-0 text-brand-700" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-brand-800">Aguinaldo {anio} estimado</p>
                      <p className="text-xl font-bold tabular-nums text-gray-900">{formatoMoneda(r.aguinaldo)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-gray-400">
                    {formatoMoneda(r.sueldoDiario)} al día × {DIAS_AGUINALDO} días × {r.diasAguinaldo} de {r.habilesAnio} días trabajables
                    {anio === anioActual ? ' (cuenta como asistidos los días que faltan del año)' : ''}
                  </p>
                </div>
              )
            })}
            {activos.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 sm:col-span-2 xl:col-span-3">
                No hay empleados. Agrégalos con el botón Empleados.
              </div>
            )}
          </div>

          {/* Días por revisar */}
          {porRevisar.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60">
              <button type="button" onClick={() => setVerRevisar((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <AlertTriangle size={18} className="shrink-0 text-amber-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-900">{porRevisar.length} {porRevisar.length === 1 ? 'día por revisar' : 'días por revisar'}</span>
                  <span className="block text-xs text-gray-600">Días hábiles sin movimiento o con muy poco en TALONES/REMI. ¿Se trabajó?</span>
                </span>
                <ChevronRight size={18} className={`shrink-0 text-gray-400 transition-transform ${verRevisar ? 'rotate-90' : ''}`} />
              </button>
              {verRevisar && (
                <ul className="divide-y divide-amber-100 border-t border-amber-200 bg-white/60">
                  {porRevisar.map((d) => (
                    <li key={d.fecha} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900">{fechaLarga(d.fecha)}</span>
                        <span className="block text-xs text-gray-500">
                          {d.tipo === 'nada' ? 'Nadie registró nada: se tomó como día no trabajado' : `Solo ${d.documentos} ${d.documentos === 1 ? 'documento' : 'documentos'} en todo el día`}
                        </span>
                      </span>
                      <button type="button" onClick={() => marcarDia(d.fecha, 'laborable')}
                        className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">Sí se trabajó</button>
                      <button type="button" onClick={() => marcarDia(d.fecha, 'cerrado')}
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">No se trabajó</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Calendario del mes */}
          <div className="rounded-2xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <div className="inline-flex items-center rounded-xl border border-gray-200 p-1">
                <button type="button" onClick={() => moverMes(-1)} disabled={mes.endsWith('-01')} aria-label="Mes anterior" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={18} /></button>
                <span className="min-w-[8.5rem] text-center text-sm font-semibold text-gray-900">{nombreMes(mes)}</span>
                <button type="button" onClick={() => moverMes(1)} disabled={mes.endsWith('-12')} aria-label="Mes siguiente" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={18} /></button>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-gray-500"><Info size={13} /> Toca un día para marcar falta, vacaciones o permiso</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-gray-500">Día</th>
                    {fechasMes.map((f) => {
                      const dow = new Date(`${f}T12:00:00`).getDay()
                      return (
                        <th key={f} className={`px-0.5 py-1.5 text-center font-medium ${f === hoy ? 'text-brand-700' : dow === 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                          <span className="block text-[10px]">{LETRA_DIA[dow]}</span>
                          <span className="block">{Number(f.slice(8))}</span>
                        </th>
                      )
                    })}
                  </tr>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white px-3 pb-2 text-left text-[11px] font-normal text-gray-400">Oficina</th>
                    {fechasMes.map((f) => {
                      const info = oficina.get(f)
                      const est = estadoOficina(f, info, feriados, hoy)
                      return (
                        <th key={f} className="px-0.5 pb-2">
                          <button type="button" onClick={() => setDiaSel(f)} title={`${fechaLarga(f)}: ${info?.documentos ?? 'sin leer'} documentos`}
                            className={`h-6 w-7 rounded-md text-[10px] font-semibold tabular-nums ${
                              est === 'cerrado' ? 'bg-gray-200 text-gray-500' : est === 'revisar' ? 'bg-amber-200 text-amber-900'
                                : est === 'no_laborable' ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-100'} ${info?.estado ? 'ring-1 ring-inset ring-gray-500' : ''}`}>
                            {est === 'no_laborable' && !info?.documentos ? '' : info?.documentos ?? '·'}
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activos.map((e) => {
                    const r = resumenes.get(e.id)!
                    return (
                      <tr key={e.id}>
                        <td className="sticky left-0 z-10 max-w-[9rem] truncate border-t border-gray-100 bg-white px-3 py-1.5 font-medium text-gray-900">{e.nombre}</td>
                        {fechasMes.map((f) => {
                          const est = r.dias.get(f) ?? 'fuera'
                          const editable = !['no_laborable', 'cerrado', 'fuera'].includes(est)
                          return (
                            <td key={f} className="border-t border-gray-100 px-0.5 py-1.5 text-center">
                              <button type="button" disabled={!editable} onClick={() => setCelda({ e, fecha: f })}
                                title={`${e.nombre} · ${fechaLarga(f)}: ${ETIQUETA_ESTADO[est]}`}
                                className={`h-7 w-7 rounded-md text-[11px] font-bold transition-transform enabled:hover:scale-110 ${CELDA[est].cls}`}>
                                {CELDA[est].letra}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-gray-100 px-4 py-3">
              {LEYENDA.map((est) => (
                <span key={est} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold ${CELDA[est].cls}`}>{CELDA[est].letra}</span>
                  {ETIQUETA_ESTADO[est]}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {celda && (
        <MarcarDia
          titulo={`${celda.e.nombre} · ${fechaLarga(celda.fecha)}`}
          actual={resumenes.get(celda.e.id)?.dias.get(celda.fecha) ?? 'futuro'}
          tieneMarca={(datos?.marcas ?? []).some((x) => x.empleado_id === celda.e.id && x.fecha === celda.fecha)}
          onElegir={async (estado) => { await marcarEmpleado(celda.e, celda.fecha, estado); setCelda(null) }}
          onCerrar={() => setCelda(null)}
        />
      )}
      {diaSel && (
        <DiaOficinaModal
          fecha={diaSel}
          info={oficina.get(diaSel)}
          festivo={feriados.has(diaSel)}
          onElegir={async (estado) => { await marcarDia(diaSel, estado); setDiaSel(null) }}
          onCerrar={() => setDiaSel(null)}
        />
      )}
      {empleados && datos && (
        <Empleados lista={datos.empleados} usuarios={datos.usuarios} onCerrar={() => setEmpleados(false)} onCambio={recargar} />
      )}
    </div>
  )
}

function Dato({ titulo, valor, cls }: { titulo: string; valor: string; cls: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-2 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{titulo}</p>
      <p className={`text-base font-bold tabular-nums ${cls}`}>{valor}</p>
    </div>
  )
}

function HojaSimple({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 animate-aparecer sm:items-center sm:p-4" onMouseDown={onCerrar}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-subir sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const OPCIONES_MARCA: { estado: EstadoManual; detalle: string }[] = [
  { estado: 'asistio', detalle: 'Sí vino aunque no registró nada' },
  { estado: 'falta', detalle: 'No cuenta para el aguinaldo' },
  { estado: 'permiso', detalle: 'Permiso sin goce: no cuenta' },
  { estado: 'vacaciones', detalle: 'Días pagados: sí cuentan' },
]

function MarcarDia({ titulo, actual, tieneMarca, onElegir, onCerrar }: {
  titulo: string; actual: EstadoDia; tieneMarca: boolean
  onElegir: (estado: EstadoManual | null) => Promise<void>; onCerrar: () => void
}) {
  const [guardando, setGuardando] = useState(false)
  const elegir = async (estado: EstadoManual | null) => { setGuardando(true); await onElegir(estado); setGuardando(false) }
  return (
    <HojaSimple titulo={titulo} onCerrar={onCerrar}>
      <p className="mb-3 text-xs text-gray-500">Ahora: <span className="font-medium text-gray-800">{ETIQUETA_ESTADO[actual]}</span></p>
      <div className="space-y-1.5">
        {OPCIONES_MARCA.map(({ estado, detalle }) => (
          <button key={estado} type="button" disabled={guardando} onClick={() => elegir(estado)}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-gray-50 disabled:opacity-60 ${actual === estado ? 'border-brand-500' : 'border-gray-200'}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${CELDA[estado].cls}`}>{CELDA[estado].letra}</span>
            <span><span className="block text-sm font-medium text-gray-900">{ETIQUETA_ESTADO[estado]}</span><span className="block text-xs text-gray-500">{detalle}</span></span>
          </button>
        ))}
        {tieneMarca && (
          <button type="button" disabled={guardando} onClick={() => elegir(null)}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60">
            Quitar la marca (volver a lo de TALONES/REMI)
          </button>
        )}
      </div>
    </HojaSimple>
  )
}

function DiaOficinaModal({ fecha, info, festivo, onElegir, onCerrar }: {
  fecha: string; info: DiaOficina | undefined; festivo: boolean
  onElegir: (estado: 'laborable' | 'cerrado' | null) => Promise<void>; onCerrar: () => void
}) {
  const [guardando, setGuardando] = useState(false)
  const elegir = async (estado: 'laborable' | 'cerrado' | null) => { setGuardando(true); await onElegir(estado); setGuardando(false) }
  const domingo = new Date(`${fecha}T12:00:00`).getDay() === 0
  return (
    <HojaSimple titulo={fechaLarga(fecha)} onCerrar={onCerrar}>
      <p className="mb-3 text-sm text-gray-600">
        {info?.documentos == null ? 'Este día todavía no se lee de TALONES/REMI.' : `${info.documentos} ${info.documentos === 1 ? 'documento' : 'documentos'} en TALONES/REMI.`}
        {festivo && ' Es día festivo de ley.'}{domingo && ' Es domingo.'}
      </p>
      <div className="space-y-1.5">
        <button type="button" disabled={guardando} onClick={() => elegir('laborable')}
          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60 ${info?.estado === 'laborable' ? 'border-brand-500' : 'border-gray-200'}`}>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-[11px] font-bold text-white">✓</span>
          <span><span className="block text-sm font-medium text-gray-900">Sí se trabajó</span><span className="block text-xs text-gray-500">Cuenta para la asistencia de todos</span></span>
        </button>
        <button type="button" disabled={guardando} onClick={() => elegir('cerrado')}
          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60 ${info?.estado === 'cerrado' ? 'border-brand-500' : 'border-gray-200'}`}>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-200 text-gray-500"><CalendarX2 size={14} /></span>
          <span><span className="block text-sm font-medium text-gray-900">No se trabajó</span><span className="block text-xs text-gray-500">Feriado o cerrado: no cuenta ni a favor ni en contra</span></span>
        </button>
        {info?.estado && (
          <button type="button" disabled={guardando} onClick={() => elegir(null)}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60">
            Volver a lo automático
          </button>
        )}
      </div>
    </HojaSimple>
  )
}

function Empleados({ lista, usuarios, onCerrar, onCambio }: {
  lista: EmpleadoTCG[]; usuarios: string[]; onCerrar: () => void; onCambio: () => void
}) {
  const [editar, setEditar] = useState<{ e?: EmpleadoTCG } | null>(null)
  if (editar) {
    return (
      <EmpleadoModal empleado={editar.e} usuarios={usuarios}
        onCerrar={() => setEditar(null)}
        onGuardado={() => { setEditar(null); aviso.exito('Empleado guardado'); onCambio() }}
        onEliminado={() => { setEditar(null); aviso.exito('Empleado eliminado'); onCambio() }} />
    )
  }
  return (
    <HojaSimple titulo="Empleados" onCerrar={onCerrar}>
      <ul className="space-y-1.5">
        {lista.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => setEditar({ e })}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left hover:bg-gray-50">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900">{e.nombre}{!e.activo && <span className="ml-1.5 text-xs font-normal text-gray-400">(de baja)</span>}</span>
                <span className="block text-xs text-gray-500">{formatoMoneda(e.sueldo_semanal)}/semana · {e.usuario_sistema ? `${e.usuario_sistema} en TALONES/REMI` : 'Exento'}</span>
              </span>
              <Pencil size={14} className="shrink-0 text-gray-400" />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setEditar({})}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
        <Plus size={16} /> Agregar empleado
      </button>
    </HojaSimple>
  )
}

function EmpleadoModal({ empleado: e, usuarios, onCerrar, onGuardado, onEliminado }: {
  empleado?: EmpleadoTCG; usuarios: string[]; onCerrar: () => void; onGuardado: () => void; onEliminado: () => void
}) {
  const [nombre, setNombre] = useState(e?.nombre ?? '')
  const [usuario, setUsuario] = useState(e?.usuario_sistema ?? '')
  const [sueldoTexto, setSueldoTexto] = useState(String(e?.sueldo_semanal ?? 2250))
  const [ingreso, setIngreso] = useState(e?.fecha_ingreso ?? '')
  const [baja, setBaja] = useState(e?.fecha_baja ?? '')
  const [activo, setActivo] = useState(e?.activo ?? true)
  const [notas, setNotas] = useState(e?.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const opcionesUsuario = [...new Set([...usuarios, ...(usuario ? [usuario.toUpperCase()] : [])])].sort()

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault()
    setError('')
    if (nombre.trim().length < 2) return setError('Escribe el nombre')
    setGuardando(true)
    try {
      const r = await fetch(e ? `/api/transportes/empleados/${e.id}` : '/api/transportes/empleados', {
        method: e ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(), usuario_sistema: usuario.trim() || null, sueldo_semanal: leerNumero(sueldoTexto),
          fecha_ingreso: ingreso || null, fecha_baja: baja || null, activo, notas: notas.trim() || null,
        }),
      })
      const j = await r.json()
      if (!r.ok) return setError(j.error ?? 'No se pudo guardar')
      onGuardado()
    } catch {
      setError('Error de red. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!e) return
    if (!(await confirmar({ titulo: `¿Eliminar a ${e.nombre}?`, mensaje: 'Se borran también sus faltas y vacaciones marcadas. Si ya no trabaja aquí, mejor dale de baja con fecha para conservar su historial.', peligro: true }))) return
    const r = await fetch(`/api/transportes/empleados/${e.id}`, { method: 'DELETE' })
    if (!r.ok) return setError('No se pudo eliminar')
    onEliminado()
  }

  return (
    <HojaCaptura titulo={e ? `Editar a ${e.nombre}` : 'Agregar empleado'} onCerrar={onCerrar} onEnviar={guardar}
      pie={
        <>
          {e && (
            <button type="button" onClick={eliminar} aria-label="Eliminar" title="Eliminar" className="rounded-xl p-3 text-gray-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={18} />
            </button>
          )}
          <button type="submit" disabled={guardando}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
            {guardando && <Loader2 size={16} className="animate-spin" />} {e ? 'Guardar cambios' : 'Agregar empleado'}
          </button>
        </>
      }>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Nombre</span>
          <input value={nombre} onChange={(ev) => setNombre(ev.target.value)} maxLength={80} required autoFocus={!e} className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Sueldo semanal</span>
          <input value={sueldoTexto} onChange={(ev) => setSueldoTexto(ev.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" className={claseCampo} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">Su usuario en TALONES/REMI</span>
        <select value={usuario.toUpperCase()} onChange={(ev) => setUsuario(ev.target.value)} className={claseCampo}>
          <option value="">Exento: no usa el sistema (presente salvo falta)</option>
          {opcionesUsuario.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <span className="mt-1 block text-xs text-gray-400">Si hizo algo en TALONES o REMI con ese usuario, ese día asistió.</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Fecha de ingreso (opcional)</span>
          <input type="date" value={ingreso} onChange={(ev) => setIngreso(ev.target.value)} className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Fecha de baja (opcional)</span>
          <input type="date" value={baja} onChange={(ev) => { setBaja(ev.target.value); if (ev.target.value) setActivo(false) }} className={claseCampo} />
        </label>
      </div>
      <p className="-mt-2 text-xs text-gray-400">Si entró a mitad de año o se fue, el aguinaldo se calcula proporcional a ese tiempo.</p>
      {e && (
        <div className="rounded-2xl border border-gray-200 p-3">
          <Interruptor titulo="Trabaja aquí" detalle="Desactívalo si se fue; su historial se conserva" valor={activo} onCambio={setActivo} />
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">Notas (opcional)</span>
        <input value={notas} onChange={(ev) => setNotas(ev.target.value)} maxLength={500} className={claseCampo} />
      </label>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
    </HojaCaptura>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Car, Droplet, FileText, Gauge, Loader2, Paperclip, Pencil, Plus, RefreshCw, Trash2, Truck, Wrench,
} from 'lucide-react'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { Buscador, EncabezadoPagina, EstadoVacio } from '@/components/ui/Pagina'
import { formatoMoneda, hoyISO } from '@/lib/finanzas'
import {
  COLOR_TRABAJO, ETIQUETA_DOCUMENTO, ETIQUETA_TRABAJO, NOMBRE_USO, TIPOS_DOCUMENTO, TIPOS_TRABAJO, diasEntre, estadoVencimiento,
  sumarMesesFecha, urlComprobanteTCG,
  type Camion, type DocumentoTCG, type EstadoAceite, type EstadoVencimiento, type TipoDocumento, type TipoTrabajo, type Trabajo, type Uso,
} from '@/lib/transportes'
import CapturaTrabajo from './CapturaTrabajo'
import { claseCampo, etiquetaDia, FotosComprobante, HojaCaptura, Interruptor, leerNumero, useComprobantes } from './comunes'

type Vehiculo = Camion & {
  trabajos: number; gastado: number; ultimo_trabajo: string | null
  kilometraje: number | null; kilometraje_fecha: string | null; aceite: EstadoAceite | null
  docs_vencidos: number; docs_proximos: number
}
type Pestana = 'trabajos' | 'documentos' | 'kilometraje'

const km = (n: number) => `${n.toLocaleString('es-MX')} km`
const fechaCorta = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

/** Chips de estado de un vehículo: aceite y documentos */
function Estados({ v }: { v: Vehiculo }) {
  const chips: { texto: string; cls: string }[] = []
  if (v.docs_vencidos) chips.push({ texto: `${v.docs_vencidos} doc. vencido${v.docs_vencidos === 1 ? '' : 's'}`, cls: 'bg-red-50 text-red-700' })
  else if (v.docs_proximos) chips.push({ texto: `${v.docs_proximos} doc. por vencer`, cls: 'bg-amber-50 text-amber-800' })
  const a = v.aceite?.estado
  if (a === 'vencido') chips.push({ texto: 'Toca cambio de aceite', cls: 'bg-red-50 text-red-700' })
  else if (a === 'pronto') chips.push({ texto: 'Aceite pronto', cls: 'bg-amber-50 text-amber-800' })
  if (!chips.length) return null
  return (
    <span className="mt-2 flex flex-wrap gap-1">
      {chips.map((c) => <span key={c.texto} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.cls}`}>{c.texto}</span>)}
    </span>
  )
}

export default function VehiculosTCG({ uso, vehiculoInicial }: { uso: Uso; vehiculoInicial: number | null }) {
  const nombre = NOMBRE_USO[uso]
  const Icono = uso === 'familia' ? Car : Truck
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [trabajos, setTrabajos] = useState<Trabajo[]>([])
  const [cargando, setCargando] = useState(true)
  const [pendiente, setPendiente] = useState(false)
  const [sel, setSel] = useState<number | null>(vehiculoInicial)
  const [pestana, setPestana] = useState<Pestana>('trabajos')
  const [tipo, setTipo] = useState<TipoTrabajo | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [captura, setCaptura] = useState<{ t?: Trabajo } | null>(null)
  const [editarVehiculo, setEditarVehiculo] = useState<{ v?: Vehiculo } | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    Promise.all([
      fetch(`/api/transportes/camiones?uso=${uso}`).then((r) => r.json()),
      fetch('/api/transportes/trabajos').then((r) => r.json()),
    ])
      .then(([c, t]) => {
        if (cancelado) return
        const lista: Vehiculo[] = c.data ?? []
        setVehiculos(lista)
        setPendiente(!!c.pendiente)
        const ids = new Set(lista.map((v) => v.id))
        setTrabajos((t.data ?? []).filter((x: Trabajo) => ids.has(x.camion_id)))
      })
      .catch(() => { if (!cancelado) aviso.error(`No se pudieron cargar los ${nombre.varios}`) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [uso, recarga, nombre.varios])

  const recargar = useCallback(() => setRecarga((n) => n + 1), [])
  const vehiculo = vehiculos.find((v) => v.id === sel) ?? null
  const nombreVehiculo = (id: number) => vehiculos.find((c) => c.id === id)?.nombre ?? '—'
  const q = busqueda.trim().toLowerCase()
  const visibles = trabajos.filter((t) =>
    (!sel || t.camion_id === sel) && (!tipo || t.tipo === tipo) &&
    (!q || [t.descripcion, t.taller, t.notas, nombreVehiculo(t.camion_id)].some((x) => x?.toLowerCase().includes(q))))
  const totalVisible = visibles.reduce((a, t) => a + t.costo, 0)
  const hoy = hoyISO()

  if (pendiente) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Falta activar documentos y kilometraje</h2>
        <p className="mt-2 text-sm text-gray-600">
          Corre una vez <code className="rounded bg-gray-100 px-1.5 py-0.5">supabase/migracion_transportes_vehiculos.sql</code> en Supabase → SQL Editor y vuelve a cargar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo={uso === 'familia' ? 'Carros' : 'Camiones'}
        subtitulo={uso === 'familia'
          ? 'Los carros de la familia: servicios, documentos, verificación y cambio de aceite (sus gastos van al hogar)'
          : 'Trabajos, documentos, verificaciones y cambio de aceite de cada camión'}
        acciones={
          <>
            <button onClick={() => setEditarVehiculo({})}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Icono size={16} /> <span className="hidden sm:inline">Agregar {nombre.uno}</span><span className="capitalize sm:hidden">{nombre.uno}</span>
            </button>
            {vehiculos.length > 0 && (
              <button onClick={() => setCaptura({})}
                className="hidden items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 sm:inline-flex">
                <Plus size={17} /> Registrar trabajo
              </button>
            )}
          </>
        }
      />

      {cargando ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : vehiculos.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<Icono size={22} />} titulo={`Agrega tus ${nombre.varios}`}
            descripcion="Con su nombre y placas. Después le registras trabajos, documentos (seguro, verificaciones…) y el kilometraje para el cambio de aceite."
            accion={<button onClick={() => setEditarVehiculo({})} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Agregar {nombre.uno}</button>} />
        </div>
      ) : (
        <>
          {/* Vehículos */}
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <div className="flex gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
              {vehiculos.map((c) => {
                const activo = sel === c.id
                return (
                  <div key={c.id}
                    className={`relative w-64 shrink-0 rounded-2xl border bg-white p-4 transition-colors sm:w-auto ${activo ? 'border-brand-500 ring-4 ring-brand-500/15' : 'border-gray-200'} ${c.activo ? '' : 'opacity-60'}`}>
                    <button type="button" onClick={() => { setSel(activo ? null : c.id); setPestana('trabajos') }} className="block w-full text-left" aria-pressed={activo}>
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icono size={20} /></span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-gray-900">{c.nombre}</span>
                          <span className="block truncate text-xs text-gray-500">
                            {[c.placas, [c.marca, c.modelo, c.anio].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Sin datos'}
                            {!c.activo && ' · de baja'}
                          </span>
                        </span>
                      </span>
                      <span className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <span><span className="block text-gray-400">Kilometraje</span><span className="font-semibold tabular-nums text-gray-900">{c.kilometraje != null ? km(c.kilometraje) : '—'}</span></span>
                        <span><span className="block text-gray-400">Gastado</span><span className="font-semibold tabular-nums text-gray-900">{formatoMoneda(c.gastado)}</span></span>
                        <span><span className="block text-gray-400">Trabajos</span><span className="font-medium text-gray-700">{c.trabajos}</span></span>
                        <span><span className="block text-gray-400">Último</span><span className="font-medium text-gray-700">{c.ultimo_trabajo ? etiquetaDia(c.ultimo_trabajo, hoy) : '—'}</span></span>
                      </span>
                      <Estados v={c} />
                    </button>
                    <button type="button" onClick={() => setEditarVehiculo({ v: c })} title={`Editar ${nombre.uno}`} aria-label={`Editar ${c.nombre}`}
                      className="absolute right-2 top-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <Pencil size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pestañas del vehículo elegido */}
          {vehiculo && (
            <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label={`Secciones del ${nombre.uno}`}>
              <div className="inline-flex min-w-full gap-1 border-b border-gray-200 sm:min-w-0">
                {([['trabajos', 'Trabajos', Wrench], ['documentos', 'Documentos', FileText], ['kilometraje', 'Kilometraje y aceite', Gauge]] as const).map(([p, label, I]) => (
                  <button key={p} onClick={() => setPestana(p)} aria-current={pestana === p ? 'page' : undefined}
                    className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${pestana === p
                      ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                    <I size={16} /> {label}
                  </button>
                ))}
              </div>
            </nav>
          )}

          {vehiculo && pestana === 'documentos' ? (
            <DocumentosVehiculo vehiculo={vehiculo} onCambio={recargar} />
          ) : vehiculo && pestana === 'kilometraje' ? (
            <KilometrajeVehiculo vehiculo={vehiculo} onCambio={recargar} onAjustar={() => setEditarVehiculo({ v: vehiculo })} />
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar trabajo, taller o nota…" className="flex-1" />
                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
                    <button type="button" onClick={() => setTipo(null)} aria-pressed={!tipo}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${!tipo ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                      Todos
                    </button>
                    {TIPOS_TRABAJO.map((tt) => (
                      <button key={tt} type="button" onClick={() => setTipo(tipo === tt ? null : tt)} aria-pressed={tipo === tt}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${tipo === tt ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_TRABAJO[tt] }} />{ETIQUETA_TRABAJO[tt]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-baseline justify-between px-1 text-sm">
                <p className="text-gray-500">
                  {sel ? <>Trabajos de <span className="font-semibold text-gray-900">{nombreVehiculo(sel)}</span></> : `Todos los ${nombre.varios}`}
                  {' · '}{visibles.length} {visibles.length === 1 ? 'trabajo' : 'trabajos'}
                </p>
                <p className="font-semibold tabular-nums text-gray-900">{formatoMoneda(totalVisible)}</p>
              </div>

              {visibles.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white">
                  <EstadoVacio icono={<Wrench size={22} />}
                    titulo={trabajos.length ? 'Sin resultados' : 'Aún no hay trabajos'}
                    descripcion={trabajos.length ? `Prueba con otro ${nombre.uno}, tipo o búsqueda.` : 'Registra el primer trabajo con el botón +.'} />
                </div>
              ) : (
                <ul className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02]">
                  {visibles.map((t) => (
                    <li key={t.id} className="border-b border-gray-100 last:border-0">
                      <button onClick={() => setCaptura({ t })} className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-gray-50">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${COLOR_TRABAJO[t.tipo]}1f`, color: COLOR_TRABAJO[t.tipo] }}>
                          {t.cambio_aceite ? <Droplet size={16} /> : <Wrench size={16} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="rounded-full px-2 py-px text-[11px] font-semibold" style={{ backgroundColor: `${COLOR_TRABAJO[t.tipo]}1f`, color: COLOR_TRABAJO[t.tipo] }}>
                              {ETIQUETA_TRABAJO[t.tipo]}
                            </span>
                            {t.cambio_aceite && <span className="rounded-full bg-amber-50 px-2 py-px text-[11px] font-semibold text-amber-800">Cambio de aceite</span>}
                            {!sel && <span className="text-xs font-semibold text-gray-700">{nombreVehiculo(t.camion_id)}</span>}
                            <span className="text-xs text-gray-400">{etiquetaDia(t.fecha, hoy)}</span>
                          </span>
                          <span className="mt-0.5 block text-sm text-gray-900">{t.descripcion}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                            {t.taller && <span>{t.taller}</span>}
                            {t.kilometraje != null && <span className="inline-flex items-center gap-1"><Gauge size={12} />{km(t.kilometraje)}</span>}
                            {(t.gasto?.comprobantes.length ?? 0) > 0 && <Paperclip size={12} aria-label="Con fotos" />}
                            {t.notas && <span className="italic">{t.notas}</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{t.costo > 0 ? formatoMoneda(t.costo) : 'Sin costo'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Botón flotante en celular */}
          <button onClick={() => setCaptura({})} aria-label="Registrar trabajo"
            className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-black/30 transition-transform active:scale-95 sm:hidden">
            <Plus size={26} />
          </button>
        </>
      )}

      {captura && (
        <CapturaTrabajo
          uso={uso}
          trabajo={captura.t}
          camiones={vehiculos}
          camionInicial={sel}
          onCerrar={() => setCaptura(null)}
          onGuardado={() => { setCaptura(null); aviso.exito(captura.t ? 'Cambios guardados' : 'Trabajo registrado'); recargar() }}
          onEliminado={() => { setCaptura(null); aviso.exito('Trabajo eliminado'); recargar() }}
        />
      )}
      {editarVehiculo && (
        <VehiculoModal
          uso={uso}
          vehiculo={editarVehiculo.v}
          onCerrar={() => setEditarVehiculo(null)}
          onGuardado={() => { setEditarVehiculo(null); aviso.exito(editarVehiculo.v ? 'Guardado' : `${nombre.uno.charAt(0).toUpperCase()}${nombre.uno.slice(1)} agregado`); recargar() }}
          onEliminado={(id) => { setEditarVehiculo(null); if (sel === id) setSel(null); aviso.exito('Eliminado'); recargar() }}
        />
      )}
    </div>
  )
}

// ── Alta y edición del vehículo (incluye cada cuánto el aceite) ─────────────

function VehiculoModal({ uso, vehiculo: c, onCerrar, onGuardado, onEliminado }: {
  uso: Uso
  vehiculo?: Vehiculo
  onCerrar: () => void
  onGuardado: () => void
  onEliminado: (id: number) => void
}) {
  const nombre = NOMBRE_USO[uso]
  const [nombreV, setNombreV] = useState(c?.nombre ?? '')
  const [placas, setPlacas] = useState(c?.placas ?? '')
  const [marca, setMarca] = useState(c?.marca ?? '')
  const [modelo, setModelo] = useState(c?.modelo ?? '')
  const [anio, setAnio] = useState(c?.anio ? String(c.anio) : '')
  const [notas, setNotas] = useState(c?.notas ?? '')
  const [activo, setActivo] = useState(c?.activo ?? true)
  // Cambio de aceite: por defecto cada 10,000 km o 6 meses, lo que pase primero
  const [cadaKm, setCadaKm] = useState(c ? (c.aceite_cada_km ? String(c.aceite_cada_km) : '') : '10000')
  const [cadaMeses, setCadaMeses] = useState(c ? (c.aceite_cada_meses ? String(c.aceite_cada_meses) : '') : '6')
  const [ultimoKm, setUltimoKm] = useState(c?.aceite_ultimo_km != null ? String(c.aceite_ultimo_km) : '')
  const [ultimaFecha, setUltimaFecha] = useState(c?.aceite_ultima_fecha ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const entero = (t: string) => (t ? Math.round(leerNumero(t)) : null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombreV.trim()) return setError(`Escribe el nombre o número del ${nombre.uno}`)
    setGuardando(true)
    try {
      const r = await fetch(c ? `/api/transportes/camiones/${c.id}` : '/api/transportes/camiones', {
        method: c ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uso, nombre: nombreV.trim(), placas: placas.trim().toUpperCase() || null, marca: marca.trim() || null, modelo: modelo.trim() || null,
          anio: entero(anio), notas: notas.trim() || null, activo,
          aceite_cada_km: entero(cadaKm), aceite_cada_meses: entero(cadaMeses),
          aceite_ultimo_km: entero(ultimoKm), aceite_ultima_fecha: ultimaFecha || null,
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
    if (!c) return
    if (!(await confirmar({ titulo: `¿Eliminar ${c.nombre}?`, mensaje: 'Se borran también sus documentos y lecturas de kilometraje. Solo se puede si no tiene trabajos registrados.', peligro: true }))) return
    const r = await fetch(`/api/transportes/camiones/${c.id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return setError(j.error ?? 'No se pudo eliminar')
    onEliminado(c.id)
  }

  return (
    <HojaCaptura titulo={c ? `Editar ${nombre.uno}` : `Agregar ${nombre.uno}`} onCerrar={onCerrar} onEnviar={guardar}
      pie={
        <>
          {c && c.trabajos === 0 && (
            <button type="button" onClick={eliminar} aria-label="Eliminar" title="Eliminar"
              className="rounded-xl p-3 text-gray-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={18} />
            </button>
          )}
          <button type="submit" disabled={guardando}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
            {guardando && <Loader2 size={16} className="animate-spin" />} {c ? 'Guardar cambios' : `Agregar ${nombre.uno}`}
          </button>
        </>
      }>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">{uso === 'familia' ? 'Nombre (cómo le dicen)' : 'Nombre o número económico'}</span>
          <input value={nombreV} onChange={(e) => setNombreV(e.target.value)} maxLength={60} autoFocus={!c} required
            placeholder={uso === 'familia' ? 'Ej. Aveo de mamá' : 'Ej. Camión 1, Kenworth rojo'} className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Placas</span>
          <input value={placas} onChange={(e) => setPlacas(e.target.value)} maxLength={20} placeholder="Ej. 123-AB-4" className={`${claseCampo} uppercase`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Marca</span>
          <input value={marca} onChange={(e) => setMarca(e.target.value)} maxLength={60} placeholder={uso === 'familia' ? 'Ej. Chevrolet' : 'Ej. International'} className={claseCampo} />
        </label>
        <div className="grid grid-cols-[1fr,6rem] gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Modelo</span>
            <input value={modelo} onChange={(e) => setModelo(e.target.value)} maxLength={60} placeholder={uso === 'familia' ? 'Ej. Aveo' : 'Ej. 4300'} className={claseCampo} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Año</span>
            <input value={anio} onChange={(e) => setAnio(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="2015" className={claseCampo} />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900"><Droplet size={15} className="text-amber-600" /> Cambio de aceite</p>
        <p className="mb-3 text-xs text-gray-500">Avisa por kilómetros o por meses, lo que pase primero. Deja vacío el que no quieras usar.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Cada (km)</span>
            <input value={cadaKm} onChange={(e) => setCadaKm(e.target.value.replace(/[^\d,]/g, ''))} inputMode="numeric" placeholder="10,000" className={claseCampo} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">O cada (meses)</span>
            <input value={cadaMeses} onChange={(e) => setCadaMeses(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="6" className={claseCampo} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Último cambio: km</span>
            <input value={ultimoKm} onChange={(e) => setUltimoKm(e.target.value.replace(/[^\d,]/g, ''))} inputMode="numeric" placeholder="Ej. 452,300" className={claseCampo} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Último cambio: fecha</span>
            <input type="date" value={ultimaFecha} max={hoyISO()} onChange={(e) => setUltimaFecha(e.target.value)} className={claseCampo} />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">El último cambio solo hace falta la primera vez; después se toma de los trabajos marcados como &quot;cambio de aceite&quot;.</p>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">Notas (opcional)</span>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej. Número de serie o motor" className={claseCampo} />
      </label>
      {c && (
        <div className="rounded-2xl border border-gray-200 p-3">
          <Interruptor titulo="En servicio" detalle="Si ya no lo tienen, desactívalo: su historial se conserva" valor={activo} onCambio={setActivo} />
        </div>
      )}
      {!c && <p className="text-xs text-gray-500">Se le crean solos los documentos de siempre (seguro, verificación{uso === 'familia' ? ', tenencia' : 'es'} y tarjeta de circulación) para que les pongas fecha y archivo.</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
    </HojaCaptura>
  )
}

// ── Documentos ─────────────────────────────────────────────────────────────

const ESTILO_VENCIMIENTO: Record<EstadoVencimiento, { cls: string; texto: (d: number) => string }> = {
  vencido: { cls: 'bg-red-50 text-red-700', texto: (d) => `Vencido hace ${-d} día${d === -1 ? '' : 's'}` },
  este_mes: { cls: 'bg-amber-50 text-amber-800', texto: (d) => (d === 0 ? 'Vence hoy' : `Toca este mes (en ${d} día${d === 1 ? '' : 's'})`) },
  pronto: { cls: 'bg-amber-50 text-amber-800', texto: (d) => `Vence en ${d} días` },
  ok: { cls: 'bg-green-50 text-green-700', texto: () => 'Al corriente' },
  sin_fecha: { cls: 'bg-gray-100 text-gray-600', texto: () => 'Sin fecha' },
}

function DocumentosVehiculo({ vehiculo, onCambio }: { vehiculo: Vehiculo; onCambio: () => void }) {
  const [docs, setDocs] = useState<DocumentoTCG[] | null>(null)
  const [editar, setEditar] = useState<{ d?: DocumentoTCG; renovar?: boolean } | null>(null)
  const [recarga, setRecarga] = useState(0)
  const hoy = hoyISO()

  useEffect(() => {
    let cancelado = false
    fetch(`/api/transportes/documentos?camion_id=${vehiculo.id}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelado) setDocs(j.data ?? []) })
      .catch(() => { if (!cancelado) setDocs([]) })
    return () => { cancelado = true }
  }, [vehiculo.id, recarga])

  const cambio = () => { setRecarga((n) => n + 1); onCambio() }

  if (!docs) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">Seguro, verificaciones, tarjeta de circulación… con su archivo y cuándo vencen. Te avisa el mes en que toca.</p>
        <button onClick={() => setEditar({})} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Plus size={15} /> Documento
        </button>
      </div>
      {docs.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<FileText size={22} />} titulo="Sin documentos" descripcion="Agrega el seguro, las verificaciones o cualquier documento importante." />
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {docs.map((d) => {
            const estado = estadoVencimiento(d.vence, hoy)
            const estilo = ESTILO_VENCIMIENTO[estado]
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-3.5 py-3 last:border-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"><FileText size={16} /></span>
                <button type="button" onClick={() => setEditar({ d })} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-gray-900">{d.nombre}</span>
                    <span className={`rounded-full px-2 py-px text-[11px] font-semibold ${estilo.cls}`}>{estilo.texto(d.vence ? diasEntre(hoy, d.vence) : 0)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {[d.vence ? `${estado === 'vencido' ? 'Venció' : 'Vence'} el ${fechaCorta(d.vence)}` : null,
                      d.cada_meses ? `se renueva cada ${d.cada_meses === 12 ? 'año' : `${d.cada_meses} meses`}` : null,
                      d.archivos.length ? `${d.archivos.length} archivo${d.archivos.length === 1 ? '' : 's'}` : 'sin archivo'].filter(Boolean).join(' · ')}
                  </span>
                </button>
                {d.archivos.length > 0 && (
                  <a href={urlComprobanteTCG(d.archivos[d.archivos.length - 1])} target="_blank" rel="noopener noreferrer" title="Abrir el archivo más reciente"
                    className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Paperclip size={16} /></a>
                )}
                {d.vence && d.cada_meses && (estado !== 'ok') && (
                  <button type="button" onClick={() => setEditar({ d, renovar: true })}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                    <RefreshCw size={12} /> Renovar
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {editar && (
        <DocumentoModal vehiculo={vehiculo} documento={editar.d} renovar={editar.renovar}
          onCerrar={() => setEditar(null)}
          onGuardado={() => { setEditar(null); aviso.exito('Documento guardado'); cambio() }} />
      )}
    </div>
  )
}

function DocumentoModal({ vehiculo, documento: d, renovar = false, onCerrar, onGuardado }: {
  vehiculo: Vehiculo; documento?: DocumentoTCG; renovar?: boolean; onCerrar: () => void; onGuardado: () => void
}) {
  const [tipo, setTipo] = useState<TipoDocumento>(d?.tipo ?? 'seguro')
  const [nombreDoc, setNombreDoc] = useState(d?.nombre ?? ETIQUETA_DOCUMENTO.seguro)
  // Renovar: la siguiente fecha sugerida es la de ahora + su periodo
  const [vence, setVence] = useState(d?.vence ? (renovar && d.cada_meses ? sumarMesesFecha(d.vence, d.cada_meses) : d.vence) : '')
  const [cadaMeses, setCadaMeses] = useState(d?.cada_meses ? String(d.cada_meses) : '')
  const [notas, setNotas] = useState(d?.notas ?? '')
  const archivos = useComprobantes(d?.archivos ?? [], 20)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function cerrar() { archivos.descartar(); onCerrar() }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (nombreDoc.trim().length < 2) return setError('Escribe el nombre del documento')
    setGuardando(true)
    try {
      const r = await fetch(d ? `/api/transportes/documentos/${d.id}` : '/api/transportes/documentos', {
        method: d ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camion_id: vehiculo.id, tipo, nombre: nombreDoc.trim(), vence: vence || null,
          cada_meses: cadaMeses ? Number(cadaMeses) : null, notas: notas.trim() || null,
          // En orden de subida: el último es el más reciente (el clip de la lista abre ese)
          archivos: archivos.comprobantes,
        }),
      })
      const j = await r.json()
      if (!r.ok) return setError(j.error ?? 'No se pudo guardar')
      archivos.confirmar()
      onGuardado()
    } catch {
      setError('Error de red. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!d) return
    if (!(await confirmar({ titulo: `¿Eliminar ${d.nombre}?`, mensaje: 'Se borran también sus archivos.', peligro: true }))) return
    const r = await fetch(`/api/transportes/documentos/${d.id}`, { method: 'DELETE' })
    if (!r.ok) return setError('No se pudo eliminar')
    onGuardado()
  }

  return (
    <HojaCaptura titulo={renovar ? `Renovar ${d?.nombre ?? ''}` : d ? 'Editar documento' : 'Nuevo documento'} onCerrar={cerrar} onEnviar={guardar}
      pie={
        <>
          {d && !renovar && (
            <button type="button" onClick={eliminar} aria-label="Eliminar" title="Eliminar" className="rounded-xl p-3 text-gray-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={18} />
            </button>
          )}
          <button type="submit" disabled={guardando || archivos.subiendo}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
            {guardando && <Loader2 size={16} className="animate-spin" />} {renovar ? 'Guardar renovación' : 'Guardar documento'}
          </button>
        </>
      }>
      {renovar && <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">Pon la nueva fecha de vencimiento y agrega el comprobante o la póliza nueva. Los archivos anteriores se quedan guardados.</p>}
      {!renovar && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Tipo</span>
            <select value={tipo} onChange={(e) => {
              const nuevo = e.target.value as TipoDocumento
              if (nombreDoc === ETIQUETA_DOCUMENTO[tipo]) setNombreDoc(ETIQUETA_DOCUMENTO[nuevo])
              setTipo(nuevo)
            }} className={claseCampo}>
              {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{ETIQUETA_DOCUMENTO[t]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Nombre</span>
            <input value={nombreDoc} onChange={(e) => setNombreDoc(e.target.value)} maxLength={120} required className={claseCampo} />
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Vence / toca el</span>
          <input type="date" value={vence} onChange={(e) => setVence(e.target.value)} className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Se renueva cada</span>
          <select value={cadaMeses} onChange={(e) => setCadaMeses(e.target.value)} className={claseCampo}>
            <option value="">No se renueva</option>
            {[3, 6, 12, 24].map((m) => <option key={m} value={m}>{m === 12 ? '1 año' : m === 24 ? '2 años' : `${m} meses`}</option>)}
          </select>
        </label>
      </div>
      <FotosComprobante c={archivos} titulo="Archivos (PDF o fotos)" />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">Notas (opcional)</span>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej. Póliza 12345, aseguradora, teléfono de siniestros" className={claseCampo} />
      </label>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
    </HojaCaptura>
  )
}

// ── Kilometraje y aceite ───────────────────────────────────────────────────

function KilometrajeVehiculo({ vehiculo: v, onCambio, onAjustar }: { vehiculo: Vehiculo; onCambio: () => void; onAjustar: () => void }) {
  const [lecturas, setLecturas] = useState<{ id: number; fecha: string; km: number; nota: string | null }[] | null>(null)
  const [nueva, setNueva] = useState(false)
  const [recarga, setRecarga] = useState(0)
  const a = v.aceite

  useEffect(() => {
    let cancelado = false
    fetch(`/api/transportes/kilometraje?camion_id=${v.id}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelado) setLecturas(j.data ?? []) })
      .catch(() => { if (!cancelado) setLecturas([]) })
    return () => { cancelado = true }
  }, [v.id, recarga])

  async function borrar(id: number) {
    if (!(await confirmar({ titulo: '¿Borrar esta lectura?', mensaje: 'Solo se quita el registro del kilometraje.', peligro: true }))) return
    const r = await fetch(`/api/transportes/kilometraje?id=${id}`, { method: 'DELETE' })
    if (!r.ok) return aviso.error('No se pudo borrar')
    setRecarga((n) => n + 1); onCambio()
  }

  const estiloAceite = a?.estado === 'vencido' ? 'border-red-200 bg-red-50' : a?.estado === 'pronto' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Kilometraje actual</p>
          <p className="text-3xl font-bold tabular-nums text-gray-900">{v.kilometraje != null ? km(v.kilometraje) : '—'}</p>
          <p className="mt-0.5 text-xs text-gray-400">{v.kilometraje_fecha ? `Última lectura: ${fechaCorta(v.kilometraje_fecha)}` : 'Aún no hay lecturas'}</p>
          <button onClick={() => setNueva(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            <Gauge size={16} /> Registrar kilometraje
          </button>
        </div>

        <div className={`rounded-2xl border p-4 ${estiloAceite}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Droplet size={16} className="text-amber-600" /> Cambio de aceite</p>
            <button onClick={onAjustar} className="text-xs font-medium text-brand-700 hover:underline">Ajustar</button>
          </div>
          {!a || a.estado === 'sin_datos' ? (
            <p className="mt-2 text-sm text-gray-600">
              {!v.aceite_cada_km && !v.aceite_cada_meses
                ? 'Dile cada cuánto se cambia (km o meses) con "Ajustar".'
                : 'Falta el último cambio: márcalo en un trabajo ("Fue cambio de aceite") o captúralo con "Ajustar".'}
            </p>
          ) : (
            <div className="mt-2 space-y-1 text-sm">
              <p className={`font-semibold ${a.estado === 'vencido' ? 'text-red-700' : a.estado === 'pronto' ? 'text-amber-800' : 'text-green-700'}`}>
                {a.estado === 'vencido' ? 'Ya toca el cambio' : a.estado === 'pronto' ? 'Toca pronto' : 'Al corriente'}
              </p>
              {a.proximoKm != null && (
                <p className="text-gray-700">
                  Próximo a los <span className="font-semibold tabular-nums">{km(a.proximoKm)}</span>
                  {a.faltanKm != null && <span className="text-gray-500"> · {a.faltanKm > 0 ? `faltan ${km(a.faltanKm)}` : `pasado por ${km(-a.faltanKm)}`}</span>}
                </p>
              )}
              {a.proximaFecha && (
                <p className="text-gray-700">
                  O el <span className="font-semibold">{fechaCorta(a.proximaFecha)}</span>
                  {a.faltanDias != null && <span className="text-gray-500"> · {a.faltanDias >= 0 ? `en ${a.faltanDias} días` : `pasado por ${-a.faltanDias} días`}</span>}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Último cambio: {[a.ultimoKm != null ? km(a.ultimoKm) : null, a.ultimaFecha ? fechaCorta(a.ultimaFecha) : null].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white">
        <p className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Lecturas</p>
        {!lecturas ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : lecturas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">Sin lecturas. El kilometraje de los trabajos también cuenta.</p>
        ) : (
          <ul>
            {lecturas.map((l) => (
              <li key={l.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-0">
                <Gauge size={15} className="shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium tabular-nums text-gray-900">{km(l.km)}</span>
                  <span className="block text-xs text-gray-500">{fechaCorta(l.fecha)}{l.nota ? ` · ${l.nota}` : ''}</span>
                </span>
                <button onClick={() => borrar(l.id)} aria-label="Borrar lectura" className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {nueva && <NuevaLectura vehiculo={v} onCerrar={() => setNueva(false)} onGuardado={() => { setNueva(false); aviso.exito('Kilometraje registrado'); setRecarga((n) => n + 1); onCambio() }} />}
    </div>
  )
}

function NuevaLectura({ vehiculo: v, onCerrar, onGuardado }: { vehiculo: Vehiculo; onCerrar: () => void; onGuardado: () => void }) {
  const [kmTexto, setKmTexto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const valor = Math.round(leerNumero(kmTexto))
    if (!kmTexto || !(valor >= 0)) return setError('Escribe el kilometraje')
    if (v.kilometraje != null && valor < v.kilometraje &&
      !(await confirmar({ titulo: '¿Seguro?', mensaje: `Es menos que el último registrado (${km(v.kilometraje)}).`, textoConfirmar: 'Guardar igual' }))) return
    setGuardando(true)
    try {
      const r = await fetch('/api/transportes/kilometraje', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camion_id: v.id, fecha, km: valor, nota: nota.trim() || null }),
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

  return (
    <HojaCaptura titulo={`Kilometraje de ${v.nombre}`} onCerrar={onCerrar} onEnviar={guardar}
      pie={
        <button type="submit" disabled={guardando}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
          {guardando && <Loader2 size={16} className="animate-spin" />} Guardar
        </button>
      }>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Kilómetros en el tablero</span>
          <input value={kmTexto} onChange={(e) => setKmTexto(e.target.value.replace(/[^\d,]/g, ''))} inputMode="numeric" autoFocus required
            placeholder={v.kilometraje != null ? v.kilometraje.toLocaleString('es-MX') : 'Ej. 452,300'} className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Fecha</span>
          <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} required className={claseCampo} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">Nota (opcional)</span>
        <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Ej. Antes del viaje a Puebla" className={claseCampo} />
      </label>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
    </HojaCaptura>
  )
}

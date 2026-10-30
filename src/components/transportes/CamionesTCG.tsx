'use client'

import { useCallback, useEffect, useState } from 'react'
import { Gauge, Loader2, Paperclip, Pencil, Plus, Trash2, Truck, Wrench } from 'lucide-react'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { Buscador, EncabezadoPagina, EstadoVacio } from '@/components/ui/Pagina'
import { formatoMoneda, hoyISO } from '@/lib/finanzas'
import { COLOR_TRABAJO, ETIQUETA_TRABAJO, TIPOS_TRABAJO, type Camion, type TipoTrabajo, type Trabajo } from '@/lib/transportes'
import CapturaTrabajo from './CapturaTrabajo'
import { claseCampo, etiquetaDia, HojaCaptura, Interruptor, leerNumero } from './comunes'

type CamionConDatos = Camion & { trabajos: number; gastado: number; ultimo_trabajo: string | null; kilometraje: number | null }

export default function CamionesTCG({ camionInicial }: { camionInicial: number | null }) {
  const [camiones, setCamiones] = useState<CamionConDatos[]>([])
  const [trabajos, setTrabajos] = useState<Trabajo[]>([])
  const [cargando, setCargando] = useState(true)
  const [camionSel, setCamionSel] = useState<number | null>(camionInicial)
  const [tipo, setTipo] = useState<TipoTrabajo | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [captura, setCaptura] = useState<{ t?: Trabajo } | null>(null)
  const [editarCamion, setEditarCamion] = useState<{ c?: CamionConDatos } | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    Promise.all([
      fetch('/api/transportes/camiones').then((r) => r.json()),
      fetch('/api/transportes/trabajos').then((r) => r.json()),
    ])
      .then(([c, t]) => { if (!cancelado) { setCamiones(c.data ?? []); setTrabajos(t.data ?? []) } })
      .catch(() => { if (!cancelado) aviso.error('No se pudieron cargar los camiones') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [recarga])

  const recargar = useCallback(() => setRecarga((n) => n + 1), [])

  const nombreCamion = (id: number) => camiones.find((c) => c.id === id)?.nombre ?? '—'
  const q = busqueda.trim().toLowerCase()
  const visibles = trabajos.filter((t) =>
    (!camionSel || t.camion_id === camionSel) && (!tipo || t.tipo === tipo) &&
    (!q || [t.descripcion, t.taller, t.notas, nombreCamion(t.camion_id)].some((x) => x?.toLowerCase().includes(q))))
  const totalVisible = visibles.reduce((a, t) => a + t.costo, 0)
  const hoy = hoyISO()

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Camiones"
        subtitulo="Trabajos mecánicos, eléctricos, de carrocería y neumáticos de cada camión"
        acciones={
          <>
            <button onClick={() => setEditarCamion({})}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Truck size={16} /> <span className="hidden sm:inline">Agregar camión</span><span className="sm:hidden">Camión</span>
            </button>
            {camiones.length > 0 && (
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
      ) : camiones.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<Truck size={22} />} titulo="Agrega tus camiones"
            descripcion="Con el nombre o número económico y sus placas. Después registras cada trabajo que se le haga."
            accion={<button onClick={() => setEditarCamion({})} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Agregar camión</button>} />
        </div>
      ) : (
        <>
          {/* Camiones */}
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <div className="flex gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
              {camiones.map((c) => {
                const activo = camionSel === c.id
                return (
                  <div key={c.id}
                    className={`relative w-64 shrink-0 rounded-2xl border bg-white p-4 transition-colors sm:w-auto ${activo ? 'border-brand-500 ring-4 ring-brand-500/15' : 'border-gray-200'} ${c.activo ? '' : 'opacity-60'}`}>
                    <button type="button" onClick={() => setCamionSel(activo ? null : c.id)} className="block w-full text-left" aria-pressed={activo}>
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Truck size={20} /></span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-gray-900">{c.nombre}</span>
                          <span className="block truncate text-xs text-gray-500">
                            {[c.placas, [c.marca, c.modelo, c.anio].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Sin datos'}
                            {!c.activo && ' · de baja'}
                          </span>
                        </span>
                      </span>
                      <span className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <span><span className="block text-gray-400">Trabajos</span><span className="font-semibold text-gray-900">{c.trabajos}</span></span>
                        <span><span className="block text-gray-400">Gastado</span><span className="font-semibold tabular-nums text-gray-900">{formatoMoneda(c.gastado)}</span></span>
                        <span><span className="block text-gray-400">Último trabajo</span><span className="font-medium text-gray-700">{c.ultimo_trabajo ? etiquetaDia(c.ultimo_trabajo, hoy) : '—'}</span></span>
                        <span><span className="block text-gray-400">Kilometraje</span><span className="font-medium tabular-nums text-gray-700">{c.kilometraje != null ? c.kilometraje.toLocaleString('es-MX') : '—'}</span></span>
                      </span>
                    </button>
                    <button type="button" onClick={() => setEditarCamion({ c })} title="Editar camión" aria-label={`Editar ${c.nombre}`}
                      className="absolute right-2 top-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <Pencil size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Filtros */}
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
              {camionSel ? <>Trabajos de <span className="font-semibold text-gray-900">{nombreCamion(camionSel)}</span></> : 'Todos los camiones'}
              {' · '}{visibles.length} {visibles.length === 1 ? 'trabajo' : 'trabajos'}
            </p>
            <p className="font-semibold tabular-nums text-gray-900">{formatoMoneda(totalVisible)}</p>
          </div>

          {visibles.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white">
              <EstadoVacio icono={<Wrench size={22} />}
                titulo={trabajos.length ? 'Sin resultados' : 'Aún no hay trabajos'}
                descripcion={trabajos.length ? 'Prueba con otro camión, tipo o búsqueda.' : 'Registra el primer trabajo con el botón +.'} />
            </div>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02]">
              {visibles.map((t) => (
                <li key={t.id} className="border-b border-gray-100 last:border-0">
                  <button onClick={() => setCaptura({ t })} className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-gray-50">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${COLOR_TRABAJO[t.tipo]}1f`, color: COLOR_TRABAJO[t.tipo] }}>
                      <Wrench size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="rounded-full px-2 py-px text-[11px] font-semibold" style={{ backgroundColor: `${COLOR_TRABAJO[t.tipo]}1f`, color: COLOR_TRABAJO[t.tipo] }}>
                          {ETIQUETA_TRABAJO[t.tipo]}
                        </span>
                        {!camionSel && <span className="text-xs font-semibold text-gray-700">{nombreCamion(t.camion_id)}</span>}
                        <span className="text-xs text-gray-400">{etiquetaDia(t.fecha, hoy)}</span>
                      </span>
                      <span className="mt-0.5 block text-sm text-gray-900">{t.descripcion}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                        {t.taller && <span>{t.taller}</span>}
                        {t.kilometraje != null && <span className="inline-flex items-center gap-1"><Gauge size={12} />{t.kilometraje.toLocaleString('es-MX')} km</span>}
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

          {/* Botón flotante en celular */}
          <button onClick={() => setCaptura({})} aria-label="Registrar trabajo"
            className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-black/30 transition-transform active:scale-95 sm:hidden">
            <Plus size={26} />
          </button>
        </>
      )}

      {captura && (
        <CapturaTrabajo
          trabajo={captura.t}
          camiones={camiones}
          camionInicial={camionSel}
          onCerrar={() => setCaptura(null)}
          onGuardado={() => { setCaptura(null); aviso.exito(captura.t ? 'Cambios guardados' : 'Trabajo registrado'); recargar() }}
          onEliminado={() => { setCaptura(null); aviso.exito('Trabajo eliminado'); recargar() }}
        />
      )}
      {editarCamion && (
        <CamionModal
          camion={editarCamion.c}
          onCerrar={() => setEditarCamion(null)}
          onGuardado={() => { setEditarCamion(null); aviso.exito(editarCamion.c ? 'Camión actualizado' : 'Camión agregado'); recargar() }}
          onEliminado={(id) => { setEditarCamion(null); if (camionSel === id) setCamionSel(null); aviso.exito('Camión eliminado'); recargar() }}
        />
      )}
    </div>
  )
}

function CamionModal({ camion: c, onCerrar, onGuardado, onEliminado }: {
  camion?: CamionConDatos
  onCerrar: () => void
  onGuardado: () => void
  onEliminado: (id: number) => void
}) {
  const [nombre, setNombre] = useState(c?.nombre ?? '')
  const [placas, setPlacas] = useState(c?.placas ?? '')
  const [marca, setMarca] = useState(c?.marca ?? '')
  const [modelo, setModelo] = useState(c?.modelo ?? '')
  const [anio, setAnio] = useState(c?.anio ? String(c.anio) : '')
  const [notas, setNotas] = useState(c?.notas ?? '')
  const [activo, setActivo] = useState(c?.activo ?? true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) return setError('Escribe el nombre o número del camión')
    setGuardando(true)
    try {
      const r = await fetch(c ? `/api/transportes/camiones/${c.id}` : '/api/transportes/camiones', {
        method: c ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(), placas: placas.trim().toUpperCase() || null, marca: marca.trim() || null, modelo: modelo.trim() || null,
          anio: anio ? Math.round(leerNumero(anio)) : null, notas: notas.trim() || null, activo,
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
    if (!(await confirmar({ titulo: `¿Eliminar ${c.nombre}?`, mensaje: 'Solo se puede si no tiene trabajos registrados.', peligro: true }))) return
    const r = await fetch(`/api/transportes/camiones/${c.id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return setError(j.error ?? 'No se pudo eliminar')
    onEliminado(c.id)
  }

  return (
    <HojaCaptura titulo={c ? 'Editar camión' : 'Agregar camión'} onCerrar={onCerrar} onEnviar={guardar}
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
            {guardando && <Loader2 size={16} className="animate-spin" />} {c ? 'Guardar cambios' : 'Agregar camión'}
          </button>
        </>
      }>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Nombre o número económico</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} autoFocus={!c} required placeholder="Ej. Camión 1, Kenworth rojo" className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Placas</span>
          <input value={placas} onChange={(e) => setPlacas(e.target.value)} maxLength={20} placeholder="Ej. 123-AB-4" className={`${claseCampo} uppercase`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Marca</span>
          <input value={marca} onChange={(e) => setMarca(e.target.value)} maxLength={60} placeholder="Ej. International" className={claseCampo} />
        </label>
        <div className="grid grid-cols-[1fr,6rem] gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Modelo</span>
            <input value={modelo} onChange={(e) => setModelo(e.target.value)} maxLength={60} placeholder="Ej. 4300" className={claseCampo} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Año</span>
            <input value={anio} onChange={(e) => setAnio(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="2015" className={claseCampo} />
          </label>
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">Notas (opcional)</span>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej. Póliza de seguro, número de serie" className={claseCampo} />
      </label>
      {c && (
        <div className="rounded-2xl border border-gray-200 p-3">
          <Interruptor titulo="En servicio" detalle="Si ya no está en la flota, desactívalo: su historial se conserva" valor={activo} onCambio={setActivo} />
        </div>
      )}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
    </HojaCaptura>
  )
}

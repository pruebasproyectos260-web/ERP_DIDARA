'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, X } from 'lucide-react'
import type { GananciaFija, IngresoManual } from '@/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

type Cot = {
  id: number; folio: string; fecha: string; estado: string
  total: number; ganancia_total?: number; ganancia_real?: number; pct_didara?: number
  cliente?: { nombre: string }
}
type Rep = {
  id: number; folio: string; fecha_ingreso: string; total: number
  cliente?: { nombre: string }; tipo_servicio?: string[]
}

interface Props {
  cotizaciones: Cot[]
  reportes: Rep[]
  ingresosManuales: IngresoManual[]
  gananciasFijas: GananciaFija[]
  nivel: number
}

function parseMesAnio(fecha: string): { anio: number; mes: number } {
  const s = fecha?.slice(0, 7) ?? ''
  const [a, m] = s.split('-').map(Number)
  return { anio: a || 0, mes: m || 0 }
}

function ganCot(c: Cot): number {
  const base = c.ganancia_real ?? c.ganancia_total ?? c.total
  const pct = (c.pct_didara ?? 100) / 100
  return base * pct
}

export default function VentasClient({ cotizaciones, reportes, ingresosManuales, gananciasFijas, nivel }: Props) {
  const anioActual = new Date().getFullYear()
  const [filtroMes,  setFiltroMes]  = useState(0)
  const [filtroAnio, setFiltroAnio] = useState(0)

  // ── Modales ─────────────────────────────────────────────────────────────────
  const [modalManual, setModalManual]   = useState(false)
  const [modalGanancia, setModalGanancia] = useState<Cot | null>(null)
  const [modalFija, setModalFija]       = useState(false)
  const [editFija, setEditFija]         = useState<GananciaFija | null>(null)

  // ── Estado local (optimista) ─────────────────────────────────────────────
  const [manuales, setManuales]   = useState<IngresoManual[]>(ingresosManuales)
  const [fijas,    setFijas]      = useState<GananciaFija[]>(gananciasFijas)
  const [cots,     setCots]       = useState<Cot[]>(cotizaciones)

  // ── Forms ────────────────────────────────────────────────────────────────
  const [fManual, setFManual] = useState({ fecha: '', monto: '', descripcion: '', notas: '' })
  const [fGan,    setFGan]    = useState({ ganancia_real: '', pct_didara: '100' })
  const [fFija,   setFFija]   = useState({ descripcion: '', monto: '', dia: '', fecha_inicio: '', notas: '' })
  const [err, setErr] = useState('')

  // ── Filtrado ─────────────────────────────────────────────────────────────
  function matchFiltro(fecha: string) {
    const { anio, mes } = parseMesAnio(fecha)
    if (filtroAnio && anio !== filtroAnio) return false
    if (filtroMes && mes !== filtroMes) return false
    return true
  }

  const cotsFilt = cots.filter((c) => matchFiltro(c.fecha))
  const repsFilt = reportes.filter((r) => matchFiltro(r.fecha_ingreso))
  const mansFilt = manuales.filter((m) => matchFiltro(m.fecha))

  const gananciasFiltradas = fijas.filter((g) => {
    if (!filtroAnio && !filtroMes) return true
    if (!g.fecha_inicio) return true
    const [fy, fm] = g.fecha_inicio.split('-').map(Number)
    const anioTarget = filtroAnio || anioActual
    const mesTarget  = filtroMes  || new Date().getMonth() + 1
    const mesKey = `${anioTarget}-${String(mesTarget).padStart(2, '0')}`
    return g.fecha_inicio <= mesKey
  })

  const totalCots = cotsFilt.reduce((a, c) => a + ganCot(c), 0)
  const totalReps = repsFilt.reduce((a, r) => a + (r.total ?? 0), 0)
  const totalMans = mansFilt.reduce((a, m) => a + m.monto, 0)
  const totalFija = gananciasFiltradas.reduce((a, g) => a + g.monto, 0)
  const totalGen  = totalCots + totalReps + totalMans + totalFija

  // ── Árbol Año → Mes ──────────────────────────────────────────────────────
  type Nodo = { anio: number; meses: { mes: number; cots: Cot[]; reps: Rep[]; mans: IngresoManual[]; fijas: GananciaFija[] }[] }
  function buildTree(): Nodo[] {
    const map = new Map<number, Nodo>()
    const ensureAnio = (a: number) => {
      if (!map.has(a)) map.set(a, { anio: a, meses: [] })
      return map.get(a)!
    }
    const ensureMes = (nodo: Nodo, m: number) => {
      let mes = nodo.meses.find((x) => x.mes === m)
      if (!mes) { mes = { mes: m, cots: [], reps: [], mans: [], fijas: [] }; nodo.meses.push(mes) }
      return mes
    }

    cotsFilt.forEach((c) => { const { anio, mes } = parseMesAnio(c.fecha); ensureMes(ensureAnio(anio), mes).cots.push(c) })
    repsFilt.forEach((r) => { const { anio, mes } = parseMesAnio(r.fecha_ingreso); ensureMes(ensureAnio(anio), mes).reps.push(r) })
    mansFilt.forEach((m) => { const { anio, mes } = parseMesAnio(m.fecha); ensureMes(ensureAnio(anio), mes).mans.push(m) })

    // Ganancias fijas aparecen en el mes/año del filtro, o en el mes actual si no hay filtro
    if (gananciasFiltradas.length) {
      const a = filtroAnio || anioActual
      const m = filtroMes  || (new Date().getMonth() + 1)
      ensureMes(ensureAnio(a), m).fijas.push(...gananciasFiltradas)
    }

    return Array.from(map.values())
      .sort((a, b) => b.anio - a.anio)
      .map((n) => ({ ...n, meses: [...n.meses].sort((a, b) => b.mes - a.mes) }))
  }

  const tree = buildTree()
  const [openAnios, setOpenAnios]  = useState<Set<number>>(new Set([anioActual]))
  const [openMeses, setOpenMeses]  = useState<Set<string>>(new Set())
  const toggleAnio  = (a: number) => setOpenAnios((s) => { const n = new Set(s); n.has(a) ? n.delete(a) : n.add(a); return n })
  const toggleMes   = (k: string) => setOpenMeses((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function guardarManual(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const res = await fetch('/api/ingresos-manuales', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: fManual.fecha, monto: parseFloat(fManual.monto), descripcion: fManual.descripcion, notas: fManual.notas || null }),
    })
    const json = await res.json()
    if (!res.ok) return setErr(json.error)
    setManuales((p) => [json.data, ...p])
    setModalManual(false)
    setFManual({ fecha: '', monto: '', descripcion: '', notas: '' })
  }

  async function eliminarManual(id: number) {
    if (!confirm('¿Eliminar este ingreso?')) return
    await fetch(`/api/ingresos-manuales/${id}`, { method: 'DELETE' })
    setManuales((p) => p.filter((m) => m.id !== id))
  }

  async function guardarGanancia(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!modalGanancia) return
    const res = await fetch(`/api/cotizaciones/${modalGanancia.id}/ganancia`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ganancia_real: parseFloat(fGan.ganancia_real), pct_didara: parseInt(fGan.pct_didara) || 100 }),
    })
    const json = await res.json()
    if (!res.ok) return setErr(json.error)
    setCots((p) => p.map((c) => c.id === modalGanancia.id ? { ...c, ...json.data } : c))
    setModalGanancia(null)
  }

  async function guardarFija(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const payload = { descripcion: fFija.descripcion, monto: parseFloat(fFija.monto), dia: fFija.dia ? parseInt(fFija.dia) : null, fecha_inicio: fFija.fecha_inicio || null, notas: fFija.notas || null }
    const url = editFija ? `/api/ganancias-fijas/${editFija.id}` : '/api/ganancias-fijas'
    const res = await fetch(url, { method: editFija ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok) return setErr(json.error)
    if (editFija) setFijas((p) => p.map((f) => f.id === editFija.id ? json.data : f))
    else setFijas((p) => [json.data, ...p])
    setEditFija(null); setModalFija(false)
    setFFija({ descripcion: '', monto: '', dia: '', fecha_inicio: '', notas: '' })
  }

  async function eliminarFija(id: number) {
    if (!confirm('¿Eliminar esta ganancia fija?')) return
    await fetch(`/api/ganancias-fijas/${id}`, { method: 'DELETE' })
    setFijas((p) => p.filter((f) => f.id !== id))
  }

  void nivel

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const btnPrimary = 'px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
  const btnSecondary = 'px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas y Ganancias</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filtroMes} onChange={(e) => setFiltroMes(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value={0}>Todos los meses</option>
            {MESES.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={filtroAnio} onChange={(e) => setFiltroAnio(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value={0}>Todos los años</option>
            {[anioActual, anioActual - 1, anioActual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={() => { setModalManual(true); setErr('') }} className={btnPrimary}>
            <Plus size={14} className="inline mr-1" />Ingreso manual
          </button>
          <button onClick={() => { setModalFija(true); setEditFija(null); setFFija({ descripcion: '', monto: '', dia: '', fecha_inicio: '', notas: '' }); setErr('') }}
            className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors">
            <Plus size={14} className="inline mr-1" />Ganancia fija
          </button>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Cotizaciones',      value: totalCots, color: 'text-green-700 bg-green-50 border-green-200' },
          { label: 'Reportes',          value: totalReps, color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: 'Manuales',          value: totalMans, color: 'text-orange-700 bg-orange-50 border-orange-200' },
          { label: 'Fijas/mes',         value: totalFija, color: 'text-purple-700 bg-purple-50 border-purple-200' },
          { label: 'Total general',     value: totalGen,  color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-xs font-medium opacity-75">{label}</p>
            <p className="text-xl font-bold mt-1">{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Árbol jerárquico */}
      {tree.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          No hay datos para el período seleccionado.
        </div>
      )}

      {tree.map((nodo) => (
        <div key={nodo.anio} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header año */}
          <button onClick={() => toggleAnio(nodo.anio)}
            className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200">
            <span className="font-bold text-gray-800">{nodo.anio}</span>
            {openAnios.has(nodo.anio) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {openAnios.has(nodo.anio) && nodo.meses.map((mesNodo) => {
            const mk = `${nodo.anio}-${mesNodo.mes}`
            const mesTotal = mesNodo.cots.reduce((a, c) => a + ganCot(c), 0)
              + mesNodo.reps.reduce((a, r) => a + (r.total ?? 0), 0)
              + mesNodo.mans.reduce((a, m) => a + m.monto, 0)
              + mesNodo.fijas.reduce((a, g) => a + g.monto, 0)

            return (
              <div key={mk} className="border-b border-gray-100 last:border-0">
                <button onClick={() => toggleMes(mk)}
                  className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-semibold text-gray-700">{MESES[mesNodo.mes]} {nodo.anio}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-green-700">{fmt(mesTotal)}</span>
                    {openMeses.has(mk) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </button>

                {openMeses.has(mk) && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Cotizaciones */}
                    {mesNodo.cots.length > 0 && (
                      <SubTable title="Cotizaciones" color="green">
                        <thead><tr className="bg-gray-50 text-xs text-gray-500">
                          <th className="text-left px-3 py-2">Folio</th>
                          <th className="text-left px-3 py-2">Cliente</th>
                          <th className="text-right px-3 py-2">Total</th>
                          <th className="text-right px-3 py-2">Ganancia</th>
                          <th className="px-3 py-2"></th>
                        </tr></thead>
                        <tbody>{mesNodo.cots.map((c) => (
                          <tr key={c.id} className="border-t border-gray-100 text-sm">
                            <td className="px-3 py-2 font-medium text-blue-700">{c.folio}</td>
                            <td className="px-3 py-2 text-gray-700">{c.cliente?.nombre ?? '-'}</td>
                            <td className="px-3 py-2 text-right">{fmt(c.total)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-green-700">
                              {fmt(ganCot(c))}
                              {c.pct_didara && c.pct_didara < 100 && <span className="ml-1 text-xs text-gray-400">({c.pct_didara}%)</span>}
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => { setModalGanancia(c); setFGan({ ganancia_real: String(c.ganancia_real ?? c.ganancia_total ?? ''), pct_didara: String(c.pct_didara ?? 100) }); setErr('') }}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded">
                                <Pencil size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </SubTable>
                    )}

                    {/* Reportes */}
                    {mesNodo.reps.length > 0 && (
                      <SubTable title="Reportes de Servicio" color="blue">
                        <thead><tr className="bg-gray-50 text-xs text-gray-500">
                          <th className="text-left px-3 py-2">Folio</th>
                          <th className="text-left px-3 py-2">Cliente</th>
                          <th className="text-left px-3 py-2">Servicio</th>
                          <th className="text-right px-3 py-2">Total</th>
                        </tr></thead>
                        <tbody>{mesNodo.reps.map((r) => (
                          <tr key={r.id} className="border-t border-gray-100 text-sm">
                            <td className="px-3 py-2 font-medium text-blue-700">{r.folio}</td>
                            <td className="px-3 py-2 text-gray-700">{r.cliente?.nombre ?? '-'}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{(r.tipo_servicio ?? []).join(', ')}</td>
                            <td className="px-3 py-2 text-right font-semibold text-blue-700">{fmt(r.total ?? 0)}</td>
                          </tr>
                        ))}</tbody>
                      </SubTable>
                    )}

                    {/* Ingresos manuales */}
                    {mesNodo.mans.length > 0 && (
                      <SubTable title="Ingresos Manuales" color="orange">
                        <thead><tr className="bg-gray-50 text-xs text-gray-500">
                          <th className="text-left px-3 py-2">Descripción</th>
                          <th className="text-right px-3 py-2">Monto</th>
                          <th className="px-3 py-2"></th>
                        </tr></thead>
                        <tbody>{mesNodo.mans.map((m) => (
                          <tr key={m.id} className="border-t border-gray-100 text-sm">
                            <td className="px-3 py-2 text-gray-700">{m.descripcion}</td>
                            <td className="px-3 py-2 text-right font-semibold text-orange-700">{fmt(m.monto)}</td>
                            <td className="px-3 py-2">
                              <button onClick={() => eliminarManual(m.id)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 size={13} /></button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </SubTable>
                    )}

                    {/* Ganancias fijas */}
                    {mesNodo.fijas.length > 0 && (
                      <SubTable title="Ganancias Fijas" color="purple">
                        <thead><tr className="bg-gray-50 text-xs text-gray-500">
                          <th className="text-left px-3 py-2">Concepto</th>
                          <th className="text-right px-3 py-2">Monto/mes</th>
                          <th className="text-center px-3 py-2">Día cobro</th>
                          <th className="px-3 py-2"></th>
                        </tr></thead>
                        <tbody>{mesNodo.fijas.map((g) => (
                          <tr key={g.id} className="border-t border-gray-100 text-sm">
                            <td className="px-3 py-2 text-gray-700">
                              {g.descripcion}
                              {g.fecha_inicio && <span className="ml-2 text-xs text-gray-400">desde {g.fecha_inicio}</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-purple-700">{fmt(g.monto)}</td>
                            <td className="px-3 py-2 text-center text-gray-500">{g.dia ? `Día ${g.dia}` : '—'}</td>
                            <td className="px-3 py-2 flex items-center gap-1">
                              <button onClick={() => { setEditFija(g); setFFija({ descripcion: g.descripcion, monto: String(g.monto), dia: String(g.dia ?? ''), fecha_inicio: g.fecha_inicio ?? '', notas: g.notas ?? '' }); setModalFija(true); setErr('') }}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded"><Pencil size={13} /></button>
                              <button onClick={() => eliminarFija(g.id)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 size={13} /></button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </SubTable>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Modal: Ingreso Manual */}
      {modalManual && (
        <Modal title="Agregar Ingreso Manual" onClose={() => setModalManual(false)}>
          <form onSubmit={guardarManual} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Fecha *</label>
                <input type="date" required value={fManual.fecha} onChange={(e) => setFManual((f) => ({ ...f, fecha: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="label">Monto ($) *</label>
                <input type="number" required min="0" step="0.01" value={fManual.monto} onChange={(e) => setFManual((f) => ({ ...f, monto: e.target.value }))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="label">Descripción *</label>
                <input type="text" required value={fManual.descripcion} onChange={(e) => setFManual((f) => ({ ...f, descripcion: e.target.value }))} className={inputCls} placeholder="Ej. Cobro en efectivo, ajuste..." />
              </div>
              <div className="col-span-2">
                <label className="label">Notas</label>
                <textarea rows={2} value={fManual.notas} onChange={(e) => setFManual((f) => ({ ...f, notas: e.target.value }))} className={inputCls} />
              </div>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalManual(false)} className={btnSecondary}>Cancelar</button>
              <button type="submit" className={btnPrimary}>Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Editar Ganancia Real */}
      {modalGanancia && (
        <Modal title={`Editar ganancia — ${modalGanancia.folio}`} onClose={() => setModalGanancia(null)}>
          <p className="text-xs text-gray-500 mb-3">Cliente: {modalGanancia.cliente?.nombre} · Total: {fmt(modalGanancia.total)}</p>
          <form onSubmit={guardarGanancia} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ganancia real ($)</label>
                <input type="number" step="0.01" value={fGan.ganancia_real} onChange={(e) => setFGan((f) => ({ ...f, ganancia_real: e.target.value }))} className={inputCls} placeholder="Ganancia actual calculada" />
              </div>
              <div>
                <label className="label">% para Didara</label>
                <input type="number" min="0" max="100" value={fGan.pct_didara} onChange={(e) => setFGan((f) => ({ ...f, pct_didara: e.target.value }))} className={inputCls} />
              </div>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalGanancia(null)} className={btnSecondary}>Cancelar</button>
              <button type="submit" className={btnPrimary}>Guardar corrección</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Ganancia Fija */}
      {modalFija && (
        <Modal title={editFija ? 'Editar Ganancia Fija' : 'Nueva Ganancia Fija'} onClose={() => { setModalFija(false); setEditFija(null) }}>
          <form onSubmit={guardarFija} className="space-y-3">
            <div>
              <label className="label">Descripción / Cliente *</label>
              <input type="text" required value={fFija.descripcion} onChange={(e) => setFFija((f) => ({ ...f, descripcion: e.target.value }))} className={inputCls} placeholder="Ej. Mantenimiento mensual - Cliente ABC" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Monto mensual ($) *</label>
                <input type="number" required min="0" step="0.01" value={fFija.monto} onChange={(e) => setFFija((f) => ({ ...f, monto: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="label">Día de cobro (1-31)</label>
                <input type="number" min="1" max="31" value={fFija.dia} onChange={(e) => setFFija((f) => ({ ...f, dia: e.target.value }))} className={inputCls} placeholder="Ej. 1" />
              </div>
              <div>
                <label className="label">Fecha de inicio {!editFija && <span className="text-red-500">*</span>}</label>
                <input type="month" required={!editFija} value={fFija.fecha_inicio} onChange={(e) => setFFija((f) => ({ ...f, fecha_inicio: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="label">Notas</label>
                <input type="text" value={fFija.notas} onChange={(e) => setFFija((f) => ({ ...f, notas: e.target.value }))} className={inputCls} />
              </div>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setModalFija(false); setEditFija(null) }} className={btnSecondary}>Cancelar</button>
              <button type="submit" className={btnPrimary}>Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function SubTable({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    green: 'text-green-700 border-green-200', blue: 'text-blue-700 border-blue-200',
    orange: 'text-orange-700 border-orange-200', purple: 'text-purple-700 border-purple-200',
  }
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${colors[color]}`}>{title}</p>
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

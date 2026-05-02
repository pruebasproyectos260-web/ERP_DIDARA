'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, X } from 'lucide-react'
import type { GastoFijo, GastoVariable } from '@/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const TIPOS_VAR = ['Combustible', 'Comida', 'Casetas', 'Transporte', 'Material', 'Papelería', 'Servicios', 'Otro']

interface Props {
  gastosFijosInit: GastoFijo[]
  gastosVariablesInit: GastoVariable[]
  nivel: number
  usuarioNombre: string
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const btnPrimary = 'px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
const btnSecondary = 'px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'

export default function GastosClient({ gastosFijosInit, gastosVariablesInit, nivel, usuarioNombre }: Props) {
  const anioActual = new Date().getFullYear()
  const mesActual  = new Date().getMonth() + 1

  const [filtroMes,  setFiltroMes]  = useState(mesActual)
  const [filtroAnio, setFiltroAnio] = useState(anioActual)

  const [fijos,     setFijos]    = useState<GastoFijo[]>(gastosFijosInit)
  const [variables, setVariables] = useState<GastoVariable[]>(gastosVariablesInit)

  // ── Collapsibles ───────────────────────────────────────────────────────────
  const [openFijos, setOpenFijos]   = useState(true)
  const [openVar,   setOpenVar]     = useState(true)
  const [openMeses, setOpenMeses]   = useState<Set<string>>(new Set())
  const toggleMes = (k: string) => setOpenMeses((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  // ── Modales ────────────────────────────────────────────────────────────────
  const [modalFijo, setModalFijo] = useState(false)
  const [editFijo, setEditFijo]   = useState<GastoFijo | null>(null)
  const [modalVar, setModalVar]   = useState(false)
  const [editVar, setEditVar]     = useState<GastoVariable | null>(null)
  const [err, setErr] = useState('')

  const [fFijo, setFFijo] = useState({ nombre: '', monto: '', dia: '', fecha_inicio: '', notas: '' })
  const [fVar,  setFVar]  = useState({ fecha: new Date().toISOString().slice(0, 10), tipo: 'Combustible', tipoOtro: '', monto: '', descripcion: '', metodo_pago: '' })

  // ── Filtrado variables ─────────────────────────────────────────────────────
  const varFiltradas = useMemo(() => {
    return variables.filter((v) => {
      const [a, m] = v.fecha.slice(0, 7).split('-').map(Number)
      if (filtroAnio && a !== filtroAnio) return false
      if (filtroMes && m !== filtroMes) return false
      return true
    })
  }, [variables, filtroMes, filtroAnio])

  // Agrupar variables por mes
  const varPorMes = useMemo(() => {
    const map = new Map<string, GastoVariable[]>()
    varFiltradas.forEach((v) => {
      const k = v.fecha.slice(0, 7)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(v)
    })
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [varFiltradas])

  // Resumen por tipo
  const resumenTipo = useMemo(() => {
    const map = new Map<string, number>()
    varFiltradas.forEach((v) => map.set(v.tipo, (map.get(v.tipo) ?? 0) + v.monto))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [varFiltradas])

  const totalFijos   = fijos.reduce((a, g) => a + g.monto, 0)
  const totalVarFilt = varFiltradas.reduce((a, g) => a + g.monto, 0)

  // ── Handlers gastos fijos ─────────────────────────────────────────────────
  function abrirNuevoFijo() {
    setEditFijo(null); setFFijo({ nombre: '', monto: '', dia: '', fecha_inicio: '', notas: '' })
    setModalFijo(true); setErr('')
  }
  function abrirEditarFijo(g: GastoFijo) {
    setEditFijo(g); setFFijo({ nombre: g.nombre, monto: String(g.monto), dia: String(g.dia ?? ''), fecha_inicio: g.fecha_inicio ?? '', notas: g.notas ?? '' })
    setModalFijo(true); setErr('')
  }

  async function guardarFijo(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const payload = { nombre: fFijo.nombre, monto: parseFloat(fFijo.monto), dia: fFijo.dia ? parseInt(fFijo.dia) : null, fecha_inicio: fFijo.fecha_inicio || null, notas: fFijo.notas || null }
    const url = editFijo ? `/api/gastos-fijos/${editFijo.id}` : '/api/gastos-fijos'
    const res = await fetch(url, { method: editFijo ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok) return setErr(json.error)
    if (editFijo) setFijos((p) => p.map((g) => g.id === editFijo.id ? json.data : g))
    else setFijos((p) => [json.data, ...p])
    setModalFijo(false); setEditFijo(null)
  }

  async function eliminarFijo(id: number) {
    if (!confirm('¿Eliminar este gasto fijo?')) return
    await fetch(`/api/gastos-fijos/${id}`, { method: 'DELETE' })
    setFijos((p) => p.filter((g) => g.id !== id))
  }

  // ── Handlers gastos variables ─────────────────────────────────────────────
  function abrirNuevoVar() {
    setEditVar(null); setFVar({ fecha: new Date().toISOString().slice(0, 10), tipo: 'Combustible', tipoOtro: '', monto: '', descripcion: '', metodo_pago: '' })
    setModalVar(true); setErr('')
  }
  function abrirEditarVar(g: GastoVariable) {
    const esOtro = !TIPOS_VAR.includes(g.tipo) || g.tipo === 'Otro'
    setEditVar(g); setFVar({ fecha: g.fecha, tipo: esOtro ? 'Otro' : g.tipo, tipoOtro: esOtro ? g.tipo : '', monto: String(g.monto), descripcion: g.descripcion ?? '', metodo_pago: g.metodo_pago ?? '' })
    setModalVar(true); setErr('')
  }

  async function guardarVar(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const tipoFinal = fVar.tipo === 'Otro' ? (fVar.tipoOtro || 'Otro') : fVar.tipo
    const payload = { fecha: fVar.fecha, tipo: tipoFinal, monto: parseFloat(fVar.monto), descripcion: fVar.descripcion || null, metodo_pago: fVar.metodo_pago || null, registrado_por: usuarioNombre || null }
    const url = editVar ? `/api/gastos-variables/${editVar.id}` : '/api/gastos-variables'
    const res = await fetch(url, { method: editVar ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok) return setErr(json.error)
    if (editVar) setVariables((p) => p.map((g) => g.id === editVar.id ? json.data : g))
    else setVariables((p) => [json.data, ...p])
    setModalVar(false); setEditVar(null)
  }

  async function eliminarVar(id: number) {
    if (!confirm('¿Eliminar este gasto?')) return
    await fetch(`/api/gastos-variables/${id}`, { method: 'DELETE' })
    setVariables((p) => p.filter((g) => g.id !== id))
  }

  const puedeEliminar = nivel <= 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Gastos</h1>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* ── GASTOS FIJOS (solo admin) ────────────────────────────────────────── */}
      {nivel <= 1 && <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={() => setOpenFijos((v) => !v)}>
          <div className="flex items-center gap-3">
            {openFijos ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="font-semibold text-gray-800">Gastos Fijos</span>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{fijos.length}</span>
            <span className="text-sm text-gray-500 hidden sm:block">{fmt(totalFijos)}/mes</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); abrirNuevoFijo() }}
            className="flex items-center gap-1 text-sm font-medium text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14} />Agregar fijo
          </button>
        </div>

        {openFijos && (
          <div className="border-t border-gray-100">
            {fijos.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Sin gastos fijos registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Nombre</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Monto/mes</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Día pago</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Inicio</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Notas</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fijos.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{g.nombre}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-700">{fmt(g.monto)}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{g.dia ? `Día ${g.dia}` : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{g.fecha_inicio ? `Desde ${g.fecha_inicio}` : '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{g.notas ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => abrirEditarFijo(g)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={13} /></button>
                          {puedeEliminar && <button onClick={() => eliminarFijo(g.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>}

      {/* ── GASTOS VARIABLES ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={() => setOpenVar((v) => !v)}>
          <div className="flex items-center gap-3">
            {openVar ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="font-semibold text-gray-800">Gastos Variables</span>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{varFiltradas.length}</span>
            <span className="text-sm text-gray-500 hidden sm:block">{fmt(totalVarFilt)}</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); abrirNuevoVar() }}
            className="flex items-center gap-1 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14} />Registrar gasto
          </button>
        </div>

        {openVar && (
          <div className="border-t border-gray-100">
            {/* Resumen por tipo */}
            {resumenTipo.length > 0 && (
              <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2">
                {resumenTipo.map(([tipo, total]) => (
                  <span key={tipo} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
                    {tipo}: {fmt(total)}
                  </span>
                ))}
              </div>
            )}

            {varPorMes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Sin gastos variables para el período.</p>
            ) : varPorMes.map(([mesKey, items]) => {
              const [anioStr, mesStr] = mesKey.split('-')
              const label = `${MESES[parseInt(mesStr)]} ${anioStr}`
              const totalMes = items.reduce((a, g) => a + g.monto, 0)

              return (
                <div key={mesKey} className="border-b border-gray-100 last:border-0">
                  <button onClick={() => toggleMes(mesKey)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      {openMeses.has(mesKey) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <span className="text-sm font-semibold text-gray-700">{label}</span>
                    </div>
                    <span className="text-sm font-bold text-red-700">-{fmt(totalMes)}</span>
                  </button>

                  {openMeses.has(mesKey) && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-y border-gray-100">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Fecha</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Tipo</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Descripción</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Monto</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 hidden sm:table-cell">Método de pago</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 hidden md:table-cell">Registrado por</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.map((g) => (
                            <tr key={g.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-gray-600">
                                {new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{g.tipo}</span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-700">{g.descripcion ?? '—'}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-red-700">{fmt(g.monto)}</td>
                              <td className="px-4 py-2.5 text-gray-600 text-xs hidden sm:table-cell">{g.metodo_pago ?? '—'}</td>
                              <td className="px-4 py-2.5 text-gray-400 text-xs hidden md:table-cell">{g.registrado_por ?? '—'}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => abrirEditarVar(g)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={13} /></button>
                                  {puedeEliminar && <button onClick={() => eliminarVar(g.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: Gasto Fijo */}
      {modalFijo && (
        <Modal title={editFijo ? 'Editar Gasto Fijo' : 'Agregar Gasto Fijo'} onClose={() => { setModalFijo(false); setEditFijo(null) }}>
          <form onSubmit={guardarFijo} className="space-y-3">
            <div>
              <label className="label">Nombre del gasto *</label>
              <input type="text" required value={fFijo.nombre} onChange={(e) => setFFijo((f) => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Ej. Sueldo Yeimi, Internet Telmex…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Monto mensual ($) *</label>
                <input type="number" required min="0" step="0.01" value={fFijo.monto} onChange={(e) => setFFijo((f) => ({ ...f, monto: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="label">Día de pago (1-31)</label>
                <input type="number" min="1" max="31" value={fFijo.dia} onChange={(e) => setFFijo((f) => ({ ...f, dia: e.target.value }))} className={inputCls} placeholder="Ej. 15" />
              </div>
              <div>
                <label className="label">Fecha de inicio {!editFijo && <span className="text-red-500">*</span>}</label>
                <input type="month" required={!editFijo} value={fFijo.fecha_inicio} onChange={(e) => setFFijo((f) => ({ ...f, fecha_inicio: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="label">Notas</label>
                <input type="text" value={fFijo.notas} onChange={(e) => setFFijo((f) => ({ ...f, notas: e.target.value }))} className={inputCls} />
              </div>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setModalFijo(false); setEditFijo(null) }} className={btnSecondary}>Cancelar</button>
              <button type="submit" className={btnPrimary}>Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Gasto Variable */}
      {modalVar && (
        <Modal title={editVar ? 'Editar Gasto Variable' : 'Registrar Gasto Variable'} onClose={() => { setModalVar(false); setEditVar(null) }}>
          <form onSubmit={guardarVar} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Fecha *</label>
                <input type="date" required value={fVar.fecha} onChange={(e) => setFVar((f) => ({ ...f, fecha: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="label">Tipo de gasto *</label>
                <select value={fVar.tipo} onChange={(e) => setFVar((f) => ({ ...f, tipo: e.target.value }))} className={inputCls}>
                  {TIPOS_VAR.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {fVar.tipo === 'Otro' && (
                <div className="col-span-2">
                  <label className="label">Especifica el tipo *</label>
                  <input type="text" required value={fVar.tipoOtro} onChange={(e) => setFVar((f) => ({ ...f, tipoOtro: e.target.value }))} className={inputCls} placeholder="Describe el tipo de gasto" />
                </div>
              )}
              <div>
                <label className="label">Monto ($) *</label>
                <input type="number" required min="0" step="0.01" value={fVar.monto} onChange={(e) => setFVar((f) => ({ ...f, monto: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="label">Método de pago</label>
                <select value={fVar.metodo_pago} onChange={(e) => setFVar((f) => ({ ...f, metodo_pago: e.target.value }))} className={inputCls}>
                  <option value="">Sin especificar</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta de débito">Tarjeta de débito</option>
                  <option value="Tarjeta de crédito">Tarjeta de crédito</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Descripción / Detalle</label>
                <input type="text" value={fVar.descripcion} onChange={(e) => setFVar((f) => ({ ...f, descripcion: e.target.value }))} className={inputCls} placeholder="Lugar, motivo, detalle…" />
              </div>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setModalVar(false); setEditVar(null) }} className={btnSecondary}>Cancelar</button>
              <button type="submit" className={btnPrimary}>Guardar</button>
            </div>
          </form>
        </Modal>
      )}
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

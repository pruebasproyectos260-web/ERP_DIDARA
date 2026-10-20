'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, Loader2, Pencil, Plus, Repeat, Trash2, X } from 'lucide-react'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { EstadoVacio } from '@/components/ui/Pagina'
import {
  CATEGORIAS_GASTO, CATEGORIAS_INGRESO, METODOS_PAGO, formatoMoneda, hoyISO, ivaSobre, mesActual, montoFijoReal, nombreMes,
  type TipoMovimiento,
} from '@/lib/finanzas'
import SelectorMes from './SelectorMes'
import { BurbujaCategoria } from './categorias'

interface Fijo {
  id: number
  tipo: TipoMovimiento
  nombre: string
  categoria: string
  monto: number
  dia: number | null
  desde: string
  hasta: string | null
  cliente_id: number | null
  metodo_pago: string | null
  con_factura: boolean
  notas: string | null
  cliente: { id: number; nombre: string } | null
  vigente: boolean
  vence: string
  hecho: { id: number; monto: number; fecha: string; metodo_pago: string | null } | null
}

const fechaCorta = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
const diasEntre = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000)

const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none'

export default function Fijos({ mes, onMes, clientes, onCambio }: {
  mes: string
  onMes: (mes: string) => void
  clientes: { id: number; nombre: string }[]
  onCambio?: () => void
}) {
  const [fijos, setFijos] = useState<Fijo[] | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [marcando, setMarcando] = useState<Fijo | null>(null)
  const [editando, setEditando] = useState<{ f?: Fijo; tipo: TipoMovimiento } | null>(null)
  const [verOtros, setVerOtros] = useState(false)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/finanzas/recurrentes?mes=${mes}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelado) setFijos(j.data ?? []) })
      .catch(() => { if (!cancelado) aviso.error('No se pudieron cargar los pagos fijos') })
    return () => { cancelado = true }
  }, [mes, recarga])

  const recargar = () => { setRecarga((n) => n + 1); onCambio?.() }

  async function desmarcar(f: Fijo) {
    if (!(await confirmar({
      titulo: `¿Desmarcar ${f.nombre}?`,
      mensaje: `Se borra el registro de ${f.tipo === 'gasto' ? 'pago' : 'cobro'} de ${nombreMes(mes)} (${formatoMoneda(f.hecho!.monto)}).`,
      textoConfirmar: 'Desmarcar', peligro: true,
    }))) return
    const r = await fetch(`/api/finanzas/recurrentes/${f.id}/mes?mes=${mes}`, { method: 'DELETE' })
    if (!r.ok) return aviso.error('No se pudo desmarcar')
    recargar()
  }

  const vigentes = (fijos ?? []).filter((f) => f.vigente)
  const otros = (fijos ?? []).filter((f) => !f.vigente)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SelectorMes mes={mes} onCambio={(m) => { setFijos(null); onMes(m) }} permitirFuturo />
        <button onClick={() => setEditando({ tipo: 'gasto' })}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          <Plus size={17} /> <span>Agregar fijo</span>
        </button>
      </div>

      {!fijos ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : fijos.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<Repeat size={22} />} titulo="Sin pagos ni cobros fijos"
            descripcion="Agrega lo que se paga o cobra cada mes (renta, internet, sueldos, pólizas) y aquí marcas cuando ya se hizo." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(['gasto', 'ingreso'] as const).map((tipo) => (
            <Seccion key={tipo} tipo={tipo} mes={mes} lista={vigentes.filter((f) => f.tipo === tipo)}
              onMarcar={setMarcando} onDesmarcar={desmarcar} onEditar={(f) => setEditando({ f, tipo })} onAgregar={() => setEditando({ tipo })} />
          ))}
        </div>
      )}

      {otros.length > 0 && (
        <div>
          <button onClick={() => setVerOtros((v) => !v)} className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800">
            <ChevronDown size={16} className={`transition-transform ${verOtros ? '' : '-rotate-90'}`} />
            {otros.length} que no aplican en {nombreMes(mes)} (terminados o por empezar)
          </button>
          {verOtros && (
            <ul className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {otros.map((f) => (
                <li key={f.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5 text-sm last:border-0">
                  <BurbujaCategoria categoria={f.categoria} tamano={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-gray-700">{f.nombre}</span>
                    <span className="block text-xs text-gray-400">
                      {f.desde > mes ? `Empieza en ${nombreMes(f.desde)}` : `Terminó en ${nombreMes(f.hasta!)}`}
                    </span>
                  </span>
                  <span className="tabular-nums text-gray-500">{formatoMoneda(f.monto)}</span>
                  <button onClick={() => setEditando({ f, tipo: f.tipo })} aria-label="Editar" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {marcando && (
        <MarcarHecho fijo={marcando} mes={mes} onCerrar={() => setMarcando(null)}
          onListo={() => { setMarcando(null); aviso.exito(marcando.tipo === 'gasto' ? 'Pago registrado' : 'Cobro registrado'); recargar() }} />
      )}
      {editando && (
        <FormFijo fijo={editando.f} tipoInicial={editando.tipo} clientes={clientes} onCerrar={() => setEditando(null)}
          onListo={(msg) => { setEditando(null); aviso.exito(msg); recargar() }} />
      )}
    </div>
  )
}

function Seccion({ tipo, mes, lista, onMarcar, onDesmarcar, onEditar, onAgregar }: {
  tipo: TipoMovimiento
  mes: string
  lista: Fijo[]
  onMarcar: (f: Fijo) => void
  onDesmarcar: (f: Fijo) => void
  onEditar: (f: Fijo) => void
  onAgregar: () => void
}) {
  const hoy = hoyISO()
  const hechos = lista.filter((f) => f.hecho)
  const faltan = lista.filter((f) => !f.hecho).reduce((a, f) => a + montoFijoReal(f), 0)
  const pct = lista.length ? (hechos.length / lista.length) * 100 : 0
  const esPago = tipo === 'gasto'

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold text-gray-900">{esPago ? 'Pagos del mes' : 'Cobros del mes'}</h3>
          <span className="text-xs text-gray-500">
            {hechos.length} de {lista.length} {esPago ? 'pagados' : 'cobrados'}
            {faltan > 0 && <> · faltan <span className="font-semibold text-gray-800">{formatoMoneda(faltan)}</span></>}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full rounded-full transition-all ${esPago ? 'bg-brand-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {lista.length === 0 ? (
        <button onClick={onAgregar} className="w-full px-4 py-8 text-center text-sm text-gray-400 hover:text-brand-700">
          {esPago ? 'Sin pagos fijos este mes · Agregar' : 'Sin cobros fijos (pólizas) este mes · Agregar'}
        </button>
      ) : (
        <ul>
          {lista.map((f) => {
            const vencido = !f.hecho && f.vence < hoy && mes <= mesActual()
            const dias = diasEntre(hoy, f.vence)
            const estado = f.hecho
              ? `${esPago ? 'Pagado' : 'Cobrado'} el ${fechaCorta(f.hecho.fecha)}${f.hecho.metodo_pago ? ` · ${f.hecho.metodo_pago}` : ''}`
              : vencido ? `Venció hace ${-dias} día${dias === -1 ? '' : 's'}`
              : dias === 0 ? 'Vence hoy' : dias > 0 && dias <= 7 ? `Vence en ${dias} día${dias === 1 ? '' : 's'}` : `Vence el ${fechaCorta(f.vence)}`
            return (
              <li key={f.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
                <button onClick={() => (f.hecho ? onDesmarcar(f) : onMarcar(f))}
                  aria-label={f.hecho ? `Desmarcar ${f.nombre}` : `Marcar ${f.nombre} como ${esPago ? 'pagado' : 'cobrado'}`}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${f.hecho
                    ? 'border-green-500 bg-green-500 text-white'
                    : vencido ? 'border-red-400 hover:bg-red-50' : 'border-gray-300 hover:border-brand-500 hover:bg-brand-50'}`}>
                  {f.hecho && <Check size={15} strokeWidth={3} />}
                </button>
                <BurbujaCategoria categoria={f.categoria} tamano={34} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${f.hecho ? 'text-gray-500' : 'text-gray-900'}`}>
                    {f.nombre}{f.cliente && !f.nombre.includes(f.cliente.nombre) ? ` · ${f.cliente.nombre}` : ''}
                  </span>
                  <span className={`block truncate text-xs ${vencido ? 'font-medium text-red-600' : 'text-gray-500'}`}>{estado}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-sm font-semibold tabular-nums ${f.hecho ? 'text-gray-400' : 'text-gray-900'}`}>
                    {formatoMoneda(f.hecho?.monto ?? montoFijoReal(f))}
                  </span>
                  {f.tipo === 'ingreso' && f.con_factura && !f.hecho && (
                    <span className="block text-[11px] text-gray-400">{formatoMoneda(f.monto)} + IVA</span>
                  )}
                </span>
                <button onClick={() => onEditar(f)} aria-label={`Editar ${f.nombre}`} className="shrink-0 rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-700">
                  <Pencil size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Hoja({ titulo, onCerrar, children, pie }: { titulo: string; onCerrar: () => void; children: React.ReactNode; pie: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 animate-aparecer sm:items-center sm:p-4" onMouseDown={onCerrar}>
      <div onMouseDown={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl animate-subir sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="font-semibold text-gray-900">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4">{children}</div>
        <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{pie}</div>
      </div>
    </div>
  )
}

function MarcarHecho({ fijo: f, mes, onCerrar, onListo }: { fijo: Fijo; mes: string; onCerrar: () => void; onListo: () => void }) {
  const hoy = hoyISO()
  const [monto, setMonto] = useState(String(f.monto))
  const [fecha, setFecha] = useState(hoy.startsWith(mes) ? hoy : f.vence)
  const [metodo, setMetodo] = useState(f.metodo_pago ?? '')
  const [guardando, setGuardando] = useState(false)
  const esPago = f.tipo === 'gasto'
  // Cobro con factura: el monto es sin IVA y el IVA se suma
  const sumaIva = !esPago && f.con_factura
  const importe = parseFloat(monto) || 0
  const iva = sumaIva ? ivaSobre(importe) : 0

  async function guardar() {
    setGuardando(true)
    try {
      const r = await fetch(`/api/finanzas/recurrentes/${f.id}/mes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, monto: parseFloat(monto), fecha, metodo_pago: metodo || null }),
      })
      const j = await r.json()
      if (!r.ok) return aviso.error(j.error ?? 'No se pudo registrar')
      onListo()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Hoja titulo={`${esPago ? 'Registrar pago' : 'Registrar cobro'} · ${f.nombre}`} onCerrar={onCerrar}
      pie={<button onClick={guardar} disabled={guardando || !(parseFloat(monto) > 0)}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        {guardando && <Loader2 size={16} className="animate-spin" />} Marcar como {esPago ? 'pagado' : 'cobrado'}
      </button>}>
      <p className="text-sm text-gray-500">{nombreMes(mes)}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">{sumaIva ? 'Monto sin IVA' : 'Monto'}</span>
          <input value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inputCls} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Fecha</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></label>
      </div>
      {sumaIva && (
        <div className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm">
          <div className="flex justify-between text-gray-600"><span>IVA 16 % (con factura)</span><span className="tabular-nums">{formatoMoneda(iva)}</span></div>
          <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-semibold text-gray-900"><span>Recibes</span><span className="tabular-nums">{formatoMoneda(importe + iva)}</span></div>
        </div>
      )}
      <div>
        <span className="mb-1 block text-xs font-medium text-gray-500">{esPago ? '¿Con qué se pagó?' : '¿Cómo se cobró?'}</span>
        <div className="flex flex-wrap gap-1.5">
          {METODOS_PAGO.map((mp) => (
            <button key={mp} type="button" onClick={() => setMetodo(metodo === mp ? '' : mp)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${metodo === mp ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {mp}
            </button>
          ))}
        </div>
      </div>
    </Hoja>
  )
}

function FormFijo({ fijo: f, tipoInicial, clientes, onCerrar, onListo }: {
  fijo?: Fijo
  tipoInicial: TipoMovimiento
  clientes: { id: number; nombre: string }[]
  onCerrar: () => void
  onListo: (mensaje: string) => void
}) {
  const [form, setForm] = useState({
    tipo: f?.tipo ?? tipoInicial,
    nombre: f?.nombre ?? '',
    categoria: f?.categoria ?? (tipoInicial === 'ingreso' ? 'Póliza' : ''),
    monto: f ? String(f.monto) : '',
    dia: f?.dia ? String(f.dia) : '',
    desde: f?.desde ?? mesActual(),
    hasta: f?.hasta ?? '',
    cliente_id: f?.cliente_id ? String(f.cliente_id) : '',
    metodo_pago: f?.metodo_pago ?? '',
    con_factura: f?.con_factura ?? false,
    notas: f?.notas ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((x) => ({ ...x, [k]: v }))
  const categorias = form.tipo === 'gasto' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      const r = await fetch(f ? `/api/finanzas/recurrentes/${f.id}` : '/api/finanzas/recurrentes', {
        method: f ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          monto: parseFloat(form.monto),
          dia: form.dia ? parseInt(form.dia) : null,
          hasta: form.hasta || null,
          cliente_id: form.tipo === 'ingreso' && form.cliente_id ? Number(form.cliente_id) : null,
          metodo_pago: form.metodo_pago || null,
          notas: form.notas || null,
        }),
      })
      const j = await r.json()
      if (!r.ok) return setError(j.error ?? 'No se pudo guardar')
      onListo(f ? 'Cambios guardados' : 'Agregado')
    } catch {
      setError('Error de red')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!f) return
    if (!(await confirmar({ titulo: `¿Eliminar ${f.nombre}?`, mensaje: 'Deja de aparecer en los meses siguientes. Lo que ya se pagó o cobró se conserva en Movimientos. Si solo terminó, mejor pon el "último mes".', peligro: true }))) return
    const r = await fetch(`/api/finanzas/recurrentes/${f.id}`, { method: 'DELETE' })
    if (!r.ok) return aviso.error('No se pudo eliminar')
    onListo('Eliminado')
  }

  return (
    <Hoja titulo={f ? `Editar ${f.nombre}` : 'Agregar pago o cobro fijo'} onCerrar={onCerrar}
      pie={<>
        {f && <button onClick={eliminar} aria-label="Eliminar" className="rounded-xl p-3 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={18} /></button>}
        <button onClick={guardar} disabled={guardando}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {guardando && <Loader2 size={16} className="animate-spin" />} Guardar
        </button>
      </>}>
      {!f && (
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          {(['gasto', 'ingreso'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setForm((x) => ({ ...x, tipo: t, categoria: t === 'ingreso' ? 'Póliza' : '' }))}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${form.tipo === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {t === 'gasto' ? 'Pago' : 'Cobro'}
            </button>
          ))}
        </div>
      )}
      <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Nombre *</span>
        <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} className={inputCls}
          placeholder={form.tipo === 'gasto' ? 'Ej. Renta oficina, Sueldo Edwin' : 'Ej. Póliza mensual Grupo CAL'} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Categoría *</span>
          <select value={form.categoria} onChange={(e) => set('categoria', e.target.value)} className={inputCls}>
            <option value="">Elige…</option>
            {[...categorias, ...(form.categoria && !(categorias as readonly string[]).includes(form.categoria) ? [form.categoria] : [])]
              .map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">{form.tipo === 'ingreso' ? 'Monto por mes sin IVA *' : 'Monto por mes *'}</span>
          <input value={form.monto} onChange={(e) => set('monto', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inputCls} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Día de {form.tipo === 'gasto' ? 'pago' : 'cobro'}</span>
          <input type="number" min={1} max={31} value={form.dia} onChange={(e) => set('dia', e.target.value)} className={inputCls} placeholder="1–31" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Desde *</span>
          <input type="month" value={form.desde} onChange={(e) => set('desde', e.target.value)} className={inputCls} /></label>
        <label className="col-span-2 block"><span className="mb-1 block text-xs font-medium text-gray-500">Último mes (solo si ya terminó)</span>
          <input type="month" value={form.hasta} onChange={(e) => set('hasta', e.target.value)} className={inputCls} /></label>
      </div>
      {form.tipo === 'ingreso' && (
        <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Cliente</span>
          <select value={form.cliente_id} onChange={(e) => set('cliente_id', e.target.value)} className={inputCls}>
            <option value="">Sin cliente</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select></label>
      )}
      <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">{form.tipo === 'gasto' ? 'Se paga con' : 'Se cobra por'}</span>
        <select value={form.metodo_pago} onChange={(e) => set('metodo_pago', e.target.value)} className={inputCls}>
          <option value="">Sin especificar</option>
          {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
        </select></label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.con_factura} onChange={(e) => set('con_factura', e.target.checked)} className="rounded" />
        {form.tipo === 'ingreso' ? 'Con factura (se le suma el IVA al cobrar)' : 'Con factura (el monto ya incluye IVA)'}
      </label>
      <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Notas</span>
        <input value={form.notas} onChange={(e) => set('notas', e.target.value)} className={inputCls} /></label>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
    </Hoja>
  )
}

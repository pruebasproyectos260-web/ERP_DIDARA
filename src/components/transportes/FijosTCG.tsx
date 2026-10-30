'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, Loader2, Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { BurbujaCategoria } from '@/components/finanzas/categorias'
import { formatoMoneda, hoyISO, mesActual, nombreMes } from '@/lib/finanzas'
import { CATEGORIAS_TCG, type Ambito, type Camion, type FijoTCG } from '@/lib/transportes'
import { claseCampo, HojaCaptura, Interruptor, leerNumero, MetodoPago } from './comunes'

const fechaCorta = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
const diasEntre = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000)

/** Gastos que se pagan cada mes: cuáles faltan, cuáles ya se pagaron, y marcarlos (crea el gasto del mes) */
export default function FijosTCG({ ambito, mes, camiones, version, onCambio }: {
  ambito: Ambito
  mes: string
  camiones: Camion[]
  /** Cambia cuando se movieron los gastos del mes (para volver a leer) */
  version: number
  onCambio: () => void
}) {
  const [fijos, setFijos] = useState<FijoTCG[] | null>(null)
  const [abierto, setAbierto] = useState(true)
  const [pagar, setPagar] = useState<FijoTCG | null>(null)
  const [editar, setEditar] = useState<{ f?: FijoTCG } | null>(null)
  const [pendiente, setPendiente] = useState(false)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/transportes/fijos?${new URLSearchParams({ ambito, mes })}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelado) { setFijos(j.data ?? []); setPendiente(!!j.pendiente) } })
      .catch(() => { if (!cancelado) setFijos([]) })
    return () => { cancelado = true }
  }, [ambito, mes, version])

  async function desmarcar(f: FijoTCG) {
    if (!(await confirmar({ titulo: `¿Desmarcar ${f.nombre}?`, mensaje: `Se borra su gasto de ${nombreMes(mes)} (${formatoMoneda(f.pagado!.monto)}).`, textoConfirmar: 'Desmarcar', peligro: true }))) return
    const r = await fetch(`/api/transportes/fijos/${f.id}/mes?mes=${mes}`, { method: 'DELETE' })
    if (!r.ok) return aviso.error('No se pudo desmarcar')
    onCambio()
  }

  if (pendiente) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Para usar los gastos fijos, corre una vez <code className="rounded bg-white px-1">supabase/migracion_transportes_fijos.sql</code> en Supabase.
      </p>
    )
  }
  if (!fijos) return null

  const vigentes = fijos.filter((f) => f.vigente)
  const pagados = vigentes.filter((f) => f.pagado)
  const faltan = vigentes.filter((f) => !f.pagado)
  const porPagar = faltan.reduce((a, f) => a + f.monto, 0)
  const hoy = hoyISO()
  const esteMes = mes === mesActual()

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setAbierto((v) => !v)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={abierto}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Repeat size={17} /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900">Gastos fijos de {nombreMes(mes).toLowerCase()}</span>
            <span className="block text-xs text-gray-500">
              {vigentes.length === 0 ? 'Renta, luz, internet, sueldos, colegiaturas… lo que se paga cada mes'
                : faltan.length === 0 ? `Todos pagados (${pagados.length})`
                  : `${pagados.length} de ${vigentes.length} pagados · faltan ${formatoMoneda(porPagar)}`}
            </span>
          </span>
          {vigentes.length > 0 && <ChevronDown size={18} className={`ml-auto shrink-0 text-gray-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />}
        </button>
        <button type="button" onClick={() => setEditar({})} title="Agregar gasto fijo" aria-label="Agregar gasto fijo"
          className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-900">
          <Plus size={16} />
        </button>
      </div>

      {abierto && vigentes.length > 0 && (
        <ul className="border-t border-gray-100">
          {vigentes.map((f) => {
            const vencido = !f.pagado && esteMes && f.vence < hoy
            const dias = diasEntre(hoy, f.vence)
            return (
              <li key={f.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-0">
                <BurbujaCategoria categoria={f.categoria} tamano={34} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-gray-900">{f.nombre}</span>
                    <button type="button" onClick={() => setEditar({ f })} aria-label={`Editar ${f.nombre}`} className="shrink-0 rounded p-0.5 text-gray-300 hover:text-gray-600"><Pencil size={12} /></button>
                  </span>
                  <span className={`block text-xs ${f.pagado ? 'text-emerald-700' : vencido ? 'font-medium text-red-600' : 'text-gray-500'}`}>
                    {f.pagado
                      ? `Pagado el ${fechaCorta(f.pagado.fecha)}${f.pagado.metodo_pago ? ` · ${f.pagado.metodo_pago}` : ''}`
                      : vencido ? `Venció hace ${-dias} ${dias === -1 ? 'día' : 'días'} (${fechaCorta(f.vence)})`
                        : esteMes && dias === 0 ? 'Vence hoy' : `Vence el ${fechaCorta(f.vence)}`}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900">{formatoMoneda(f.pagado?.monto ?? f.monto)}</span>
                {f.pagado ? (
                  <button type="button" onClick={() => desmarcar(f)} title="Desmarcar"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600"><Check size={16} /></button>
                ) : (
                  <button type="button" onClick={() => setPagar(f)}
                    className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">Pagar</button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {pagar && <PagarFijo fijo={pagar} mes={mes} onCerrar={() => setPagar(null)} onPagado={() => { setPagar(null); aviso.exito('Pago registrado'); onCambio() }} />}
      {editar && (
        <EditarFijo ambito={ambito} fijo={editar.f} camiones={camiones} mesInicial={mes}
          onCerrar={() => setEditar(null)}
          onGuardado={() => { setEditar(null); aviso.exito(editar.f ? 'Gasto fijo actualizado' : 'Gasto fijo agregado'); onCambio() }} />
      )}
    </div>
  )
}

function PagarFijo({ fijo: f, mes, onCerrar, onPagado }: { fijo: FijoTCG; mes: string; onCerrar: () => void; onPagado: () => void }) {
  const [montoTexto, setMontoTexto] = useState(String(f.monto))
  const [fecha, setFecha] = useState(mes === mesActual() || mes > mesActual() ? hoyISO() : f.vence)
  const [metodo, setMetodo] = useState(f.metodo_pago ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const monto = leerNumero(montoTexto)
    if (!(monto > 0)) return setError('Escribe el monto')
    setGuardando(true)
    try {
      const r = await fetch(`/api/transportes/fijos/${f.id}/mes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, monto, fecha, metodo_pago: metodo || null }),
      })
      const j = await r.json()
      if (!r.ok) return setError(j.error ?? 'No se pudo registrar')
      onPagado()
    } catch {
      setError('Error de red. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <HojaCaptura titulo={`Pagar ${f.nombre}`} onCerrar={onCerrar} onEnviar={guardar}
      pie={
        <button type="submit" disabled={guardando}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
          {guardando && <Loader2 size={16} className="animate-spin" />} Registrar pago de {nombreMes(mes).toLowerCase()}
        </button>
      }>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Monto pagado</span>
          <input value={montoTexto} onChange={(e) => setMontoTexto(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" autoFocus className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Fecha de pago</span>
          <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} required className={claseCampo} />
        </label>
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-gray-500">¿Con qué se pagó?</span>
        <MetodoPago valor={metodo} onCambio={setMetodo} />
      </div>
      <p className="text-xs text-gray-500">Se registra como gasto de {f.ambito === 'hogar' ? 'la casa' : 'la empresa'} en {f.categoria}. Si quieres agregar la foto del recibo, ábrelo después en la lista.</p>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
    </HojaCaptura>
  )
}

function EditarFijo({ ambito, fijo: f, camiones, mesInicial, onCerrar, onGuardado }: {
  ambito: Ambito; fijo?: FijoTCG; camiones: Camion[]; mesInicial: string; onCerrar: () => void; onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(f?.nombre ?? '')
  const [categoria, setCategoria] = useState(f?.categoria ?? '')
  const [montoTexto, setMontoTexto] = useState(f ? String(f.monto) : '')
  const [diaTexto, setDiaTexto] = useState(f?.dia ? String(f.dia) : '')
  const [desde, setDesde] = useState(f?.desde ?? mesInicial)
  const [hasta, setHasta] = useState(f?.hasta ?? '')
  const [metodo, setMetodo] = useState(f?.metodo_pago ?? '')
  const [conFactura, setConFactura] = useState(f?.con_factura ?? false)
  const [camionId, setCamionId] = useState(f?.camion_id ? String(f.camion_id) : '')
  const [notas, setNotas] = useState(f?.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const categorias = CATEGORIAS_TCG[ambito]
  const opciones = categoria && !categorias.includes(categoria) ? [...categorias, categoria] : categorias

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const monto = leerNumero(montoTexto)
    if (nombre.trim().length < 2) return setError('Escribe qué se paga')
    if (!categoria) return setError('Elige una categoría')
    if (!(monto > 0)) return setError('Escribe el monto')
    setGuardando(true)
    try {
      const r = await fetch(f ? `/api/transportes/fijos/${f.id}` : '/api/transportes/fijos', {
        method: f ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambito, nombre: nombre.trim(), categoria, monto,
          dia: diaTexto ? Math.min(31, Math.max(1, Math.round(leerNumero(diaTexto)))) : null,
          desde, hasta: hasta || null, metodo_pago: metodo || null, con_factura: conFactura,
          camion_id: ambito === 'empresa' && camionId ? Number(camionId) : null, notas: notas.trim() || null,
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
    if (!f) return
    if (!(await confirmar({ titulo: `¿Eliminar ${f.nombre}?`, mensaje: 'Deja de aparecer cada mes. Los pagos que ya registraste se quedan en tus gastos. Si solo dejó de pagarse, mejor pon un "último mes".', peligro: true }))) return
    const r = await fetch(`/api/transportes/fijos/${f.id}`, { method: 'DELETE' })
    if (!r.ok) return setError('No se pudo eliminar')
    onGuardado()
  }

  return (
    <HojaCaptura titulo={f ? 'Editar gasto fijo' : 'Nuevo gasto fijo'} onCerrar={onCerrar} onEnviar={guardar}
      pie={
        <>
          {f && (
            <button type="button" onClick={eliminar} aria-label="Eliminar" title="Eliminar" className="rounded-xl p-3 text-gray-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={18} />
            </button>
          )}
          <button type="submit" disabled={guardando}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
            {guardando && <Loader2 size={16} className="animate-spin" />} {f ? 'Guardar cambios' : 'Agregar gasto fijo'}
          </button>
        </>
      }>
      <div className="grid gap-3 sm:grid-cols-[1fr,9rem]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">¿Qué se paga?</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} autoFocus={!f} required
            placeholder={ambito === 'hogar' ? 'Ej. Colegiatura, luz, internet' : 'Ej. Renta del patio, seguro, sueldo Rubén'} className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Monto al mes</span>
          <input value={montoTexto} onChange={(e) => setMontoTexto(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="0.00" className={claseCampo} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">Categoría</span>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} required className={claseCampo}>
          <option value="">Elige una categoría</option>
          {opciones.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Día que vence</span>
          <input value={diaTexto} onChange={(e) => setDiaTexto(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="Ej. 15" className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Desde</span>
          <input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} required className={claseCampo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Último mes</span>
          <input type="month" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className={claseCampo} />
        </label>
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-gray-500">¿Con qué se paga normalmente?</span>
        <MetodoPago valor={metodo} onCambio={setMetodo} />
      </div>
      {ambito === 'empresa' && camiones.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Camión (opcional)</span>
          <select value={camionId} onChange={(e) => setCamionId(e.target.value)} className={claseCampo}>
            <option value="">De la empresa en general</option>
            {camiones.filter((c) => c.activo || String(c.id) === camionId).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      )}
      <div className="rounded-2xl border border-gray-200 p-3">
        <Interruptor titulo="Con factura" detalle="El IVA (16 %) se calcula incluido en el monto" valor={conFactura} onCambio={setConFactura} />
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">Notas (opcional)</span>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={300} placeholder="Ej. Número de contrato o referencia" className={claseCampo} />
      </label>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
    </HojaCaptura>
  )
}

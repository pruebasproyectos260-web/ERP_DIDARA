'use client'

import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Download, FileSpreadsheet, Loader2, Mail } from 'lucide-react'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { Segmentado } from '@/components/ui/Pagina'
import { formatoMoneda, hoyISO, rangoMes } from '@/lib/finanzas'
import SelectorMes from './SelectorMes'

interface Suma { n: number; subtotal: number; iva: number; total: number }
interface Datos {
  titulo: string
  ingresos: unknown[]
  gastos: unknown[]
  resumen: {
    ingresos: { conFactura: Suma; sinFactura: Suma; total: number }
    gastos: { conFactura: Suma; sinFactura: Suma; total: number }
    iva: { cobrado: number; pagado: number; diferencia: number }
  }
  pendientes: {
    gastosSinComprobante: { fecha: string; proveedor: string; concepto: string; total: number }[]
    ingresosSinIva: { fecha: string; cliente: string; concepto: string; total: number }[]
    gastosSinRevisar: { fecha: string; concepto: string; categoria: string; total: number; registro: string }[]
    fijosSinMarcar: { mes: string; nombre: string; monto: number; tipo: string }[]
    porCobrar: { folio: string; cliente: string; saldo: number }[]
  }
  destinatarios: { para: string[]; cc: string[] }
}

type Modo = 'mes' | 'rango'

export default function Contabilidad({ mes, onMes }: { mes: string; onMes: (m: string) => void }) {
  const [modo, setModo] = useState<Modo>('mes')
  const hoy = hoyISO()
  const [rango, setRango] = useState({ desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy })
  const periodo = modo === 'mes' ? rangoMes(mes) : rango
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const consulta = new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta }).toString()

  useEffect(() => {
    let cancelado = false
    fetch(`/api/finanzas/contabilidad?${consulta}`)
      .then(async (r) => {
        const j = await r.json()
        if (cancelado) return
        if (!r.ok) setError(j.error ?? 'No se pudo cargar')
        else { setError(''); setDatos(j.data) }
      })
      .catch(() => { if (!cancelado) setError('Error de red') })
    return () => { cancelado = true }
  }, [consulta])

  async function enviar() {
    if (!datos) return
    if (!(await confirmar({
      titulo: `¿Enviar ${datos.titulo} a contabilidad?`,
      mensaje: `Se manda el Excel por correo a ${datos.destinatarios.para.join(', ')}${datos.destinatarios.cc.length ? ` (copia a ${datos.destinatarios.cc.join(', ')})` : ''}.`,
      textoConfirmar: 'Enviar',
    }))) return
    setEnviando(true)
    try {
      const r = await fetch('/api/finanzas/contabilidad/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(periodo),
      })
      const j = await r.json()
      if (!r.ok) return aviso.error(j.error ?? 'No se pudo enviar')
      aviso.exito(`Enviado a ${j.data.para.join(', ')}`)
    } finally {
      setEnviando(false)
    }
  }

  const r = datos?.resumen
  const p = datos?.pendientes
  const totalPendientes = p ? p.gastosSinComprobante.length + p.ingresosSinIva.length + p.gastosSinRevisar.length + p.fijosSinMarcar.length : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmentado opciones={[{ value: 'mes', label: 'Por mes' }, { value: 'rango', label: 'Rango de fechas' }]} valor={modo} onCambio={(m) => { setDatos(null); setModo(m) }} />
        {modo === 'mes' ? (
          <SelectorMes mes={mes} onCambio={(m) => { setDatos(null); onMes(m) }} />
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={rango.desde} max={rango.hasta} onChange={(e) => { setDatos(null); setRango((x) => ({ ...x, desde: e.target.value })) }}
              className="rounded-xl border border-gray-200 px-3 py-2 focus:border-brand-500 focus:outline-none" aria-label="Desde" />
            <span className="text-gray-400">a</span>
            <input type="date" value={rango.hasta} min={rango.desde} onChange={(e) => { setDatos(null); setRango((x) => ({ ...x, hasta: e.target.value })) }}
              className="rounded-xl border border-gray-200 px-3 py-2 focus:border-brand-500 focus:outline-none" aria-label="Hasta" />
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <a href={`/api/finanzas/contabilidad/excel?${consulta}`}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
            <Download size={16} /> Descargar Excel
          </a>
          <button onClick={enviar} disabled={!datos || enviando}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} <span className="hidden sm:inline">Enviar a contabilidad</span>
          </button>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        : !datos || !r || !p ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>
        : (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              <Tarjeta titulo="Ingresos" total={r.ingresos.total} filas={[
                ['Con factura', r.ingresos.conFactura.total, `${r.ingresos.conFactura.n} · IVA ${formatoMoneda(r.ingresos.conFactura.iva)}`],
                ['Sin factura', r.ingresos.sinFactura.total, `${r.ingresos.sinFactura.n}`],
              ]} color="text-green-600" />
              <Tarjeta titulo="Gastos" total={r.gastos.total} filas={[
                ['Con factura', r.gastos.conFactura.total, `${r.gastos.conFactura.n} · IVA ${formatoMoneda(r.gastos.conFactura.iva)}`],
                ['Sin factura', r.gastos.sinFactura.total, `${r.gastos.sinFactura.n}`],
              ]} color="text-gray-900" />
              <section className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">IVA del periodo (estimado)</p>
                <p className={`mt-0.5 text-2xl font-bold tabular-nums ${r.iva.diferencia >= 0 ? 'text-red-600' : 'text-green-600'}`}>{formatoMoneda(Math.abs(r.iva.diferencia))}</p>
                <p className="text-xs text-gray-500">{r.iva.diferencia >= 0 ? 'por pagar' : 'a favor'}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-gray-500">IVA cobrado</dt><dd className="tabular-nums">{formatoMoneda(r.iva.cobrado)}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">IVA pagado (acreditable)</dt><dd className="tabular-nums">{formatoMoneda(r.iva.pagado)}</dd></div>
                </dl>
              </section>
            </div>

            <section className="rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                {totalPendientes ? <CircleAlert size={18} className="text-amber-500" /> : <CircleCheck size={18} className="text-green-600" />}
                <h3 className="font-semibold text-gray-900">{totalPendientes ? `${totalPendientes} pendientes antes de entregar a contabilidad` : 'Todo en orden para contabilidad'}</h3>
              </div>
              <div className="grid gap-px bg-gray-100 sm:grid-cols-2">
                <Pendiente titulo="Gastos con factura sin foto" items={p.gastosSinComprobante.map((g) => `${g.fecha.slice(5)} · ${g.proveedor || g.concepto} · ${formatoMoneda(g.total)}`)} />
                <Pendiente titulo="Cobros con factura sin IVA" items={p.ingresosSinIva.map((i) => `${i.fecha.slice(5)} · ${i.cliente || i.concepto} · ${formatoMoneda(i.total)}`)} />
                <Pendiente titulo="Gastos sin revisar" items={p.gastosSinRevisar.map((g) => `${g.fecha.slice(5)} · ${g.concepto || g.categoria} · ${formatoMoneda(g.total)} · ${g.registro}`)} />
                <Pendiente titulo="Fijos sin marcar" items={p.fijosSinMarcar.map((f) => `${f.mes} · ${f.nombre} · ${formatoMoneda(f.monto)}`)} />
              </div>
            </section>

            <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
              <FileSpreadsheet size={18} className="mt-0.5 shrink-0" />
              <span>
                El Excel trae 4 hojas: Resumen, Ingresos ({datos.ingresos.length}), Gastos ({datos.gastos.length}) y Pendientes.
                Cada <strong>día 1 a las 8 am</strong> se envía solo el del mes anterior a <strong>{datos.destinatarios.para.join(', ')}</strong>
                {datos.destinatarios.cc.length ? <> con copia a {datos.destinatarios.cc.join(', ')}</> : null}.
              </span>
            </p>
          </>
        )}
    </div>
  )
}

function Tarjeta({ titulo, total, filas, color }: { titulo: string; total: number; filas: [string, number, string][]; color: string }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{titulo}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${color}`}>{formatoMoneda(total)}</p>
      <dl className="mt-3 space-y-1 text-sm">
        {filas.map(([etq, monto, detalle]) => (
          <div key={etq} className="flex items-baseline justify-between gap-2">
            <dt className="text-gray-500">{etq} <span className="text-xs text-gray-400">({detalle})</span></dt>
            <dd className="tabular-nums">{formatoMoneda(monto)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Pendiente({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="flex items-center justify-between text-sm font-medium text-gray-800">
        {titulo}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${items.length ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>{items.length || '✓'}</span>
      </p>
      {items.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-xs text-gray-500">
          {items.slice(0, 4).map((t, i) => <li key={i} className="truncate">{t}</li>)}
          {items.length > 4 && <li className="text-gray-400">y {items.length - 4} más (ver Excel)</li>}
        </ul>
      )}
    </div>
  )
}

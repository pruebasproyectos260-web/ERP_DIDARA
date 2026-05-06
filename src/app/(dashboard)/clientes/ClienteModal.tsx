'use client'

import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import type { Cliente, Contacto, Direccion } from '@/types'

interface Props {
  cliente: Cliente | null
  onClose: () => void
  onGuardado: (cliente: Cliente) => void
}

const contactoVacio = (): Contacto => ({ nombre: '', telefono: '', email: '', puesto: '', es_fiscal: false })
const contactoDirVacio = (): Contacto => ({ nombre: '', telefono: '', email: '', puesto: '' })
const direccionVacia = (): Direccion => ({ etiqueta: '', direccion: '', contactos: [] })

function initDirecciones(cliente: Cliente | null): Direccion[] {
  if (!cliente) return [direccionVacia()]
  if (cliente.direcciones?.length > 0) return cliente.direcciones.map(d => ({
    ...d,
    contactos: d.contactos ?? [],
  }))
  if (cliente.direccion) return [{ etiqueta: 'Principal', direccion: cliente.direccion, contactos: [] }]
  return [direccionVacia()]
}

export default function ClienteModal({ cliente, onClose, onGuardado }: Props) {
  const esNuevo = !cliente

  const [form, setForm] = useState({
    nombre: cliente?.nombre ?? '',
    rfc: cliente?.rfc ?? '',
    telefono: cliente?.telefono ?? '',
    email: cliente?.email ?? '',
    notas: cliente?.notas ?? '',
    regimen_fiscal: cliente?.regimen_fiscal ?? '',
    uso_cfdi: cliente?.uso_cfdi ?? '',
    descuento: cliente?.descuento?.toString() ?? '0',
    tiene_poliza: cliente?.tiene_poliza ?? false,
  })
  const [direcciones, setDirecciones] = useState<Direccion[]>(initDirecciones(cliente))
  const [contactos, setContactos] = useState<Contacto[]>(
    cliente?.contactos?.length ? cliente.contactos : [contactoVacio()]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Helpers direcciones ──────────────────────────────────────
  function setDireccionField(i: number, field: 'etiqueta' | 'direccion', value: string) {
    setDirecciones(prev => {
      const arr = [...prev]
      arr[i] = { ...arr[i], [field]: value }
      return arr
    })
  }

  function removeDireccion(i: number) {
    setDirecciones(prev => prev.filter((_, j) => j !== i))
  }

  // Contactos dentro de una dirección
  function addContactoDir(dirIdx: number) {
    setDirecciones(prev => {
      const arr = [...prev]
      arr[dirIdx] = { ...arr[dirIdx], contactos: [...arr[dirIdx].contactos, contactoDirVacio()] }
      return arr
    })
  }

  function setContactoDir(dirIdx: number, cIdx: number, field: keyof Contacto, value: string) {
    setDirecciones(prev => {
      const arr = [...prev]
      const contactos = [...arr[dirIdx].contactos]
      contactos[cIdx] = { ...contactos[cIdx], [field]: value }
      arr[dirIdx] = { ...arr[dirIdx], contactos }
      return arr
    })
  }

  function removeContactoDir(dirIdx: number, cIdx: number) {
    setDirecciones(prev => {
      const arr = [...prev]
      arr[dirIdx] = { ...arr[dirIdx], contactos: arr[dirIdx].contactos.filter((_, j) => j !== cIdx) }
      return arr
    })
  }

  // ── Helpers contactos generales ──────────────────────────────
  function setContacto(i: number, field: keyof Contacto, value: string | boolean) {
    setContactos(prev => {
      const arr = [...prev]
      arr[i] = { ...arr[i], [field]: value }
      return arr
    })
  }

  function marcarFiscal(i: number) {
    setContactos(prev => prev.map((c, j) => ({ ...c, es_fiscal: j === i })))
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.nombre.trim()) return setError('El nombre es requerido')
    setLoading(true)
    setError('')

    const direccionesFiltradas = direcciones.filter(d => d.direccion.trim()).map(d => ({
      ...d,
      contactos: d.contactos.filter(c => c.nombre.trim() || c.email?.trim()),
    }))
    const contactosFiltrados = contactos.filter(c => c.nombre.trim() || c.email?.trim())

    const payload = {
      ...form,
      descuento: parseFloat(form.descuento) || 0,
      regimen_fiscal: form.regimen_fiscal || null,
      uso_cfdi: form.uso_cfdi || null,
      direcciones: direccionesFiltradas,
      contactos: contactosFiltrados,
    }

    try {
      const res = await fetch(
        esNuevo ? '/api/clientes' : `/api/clientes/${cliente.id}`,
        { method: esNuevo ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      const json = await res.json()
      if (!res.ok) return setError(json.error ?? 'Error al guardar')
      onGuardado(json.data)
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold">{esNuevo ? 'Nuevo cliente' : 'Editar cliente'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Form */}
        <form id="cliente-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* Datos principales */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Razón social <span className="text-red-500">*</span></label>
              <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
              <input type="text" value={form.rfc} onChange={e => setForm(f => ({ ...f, rfc: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="text" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo general</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descuento (%)</label>
              <input type="number" step="0.01" value={form.descuento}
                onChange={e => setForm(f => ({ ...f, descuento: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0 (negativo = cargo extra)" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Régimen fiscal</label>
              <input type="text" value={form.regimen_fiscal}
                onChange={e => setForm(f => ({ ...f, regimen_fiscal: e.target.value }))}
                placeholder="ej. 601, 616, 626"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uso de CFDI</label>
              <input type="text" value={form.uso_cfdi}
                onChange={e => setForm(f => ({ ...f, uso_cfdi: e.target.value }))}
                placeholder="ej. G01, G03, P01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.tiene_poliza} onChange={e => setForm(f => ({ ...f, tiene_poliza: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 w-4 h-4" />
                <span className="text-sm font-medium text-gray-700">Tiene póliza con nosotros</span>
              </label>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>

          {/* Direcciones (con contactos por dirección) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Direcciones</label>
              <button type="button" onClick={() => setDirecciones(prev => [...prev, direccionVacia()])}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <Plus size={13} /> Agregar dirección
              </button>
            </div>
            <div className="space-y-3">
              {direcciones.map((d, di) => (
                <div key={di} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  {/* Fila de dirección */}
                  <div className="flex items-center gap-2">
                    <input type="text" value={d.etiqueta} onChange={e => setDireccionField(di, 'etiqueta', e.target.value)}
                      placeholder="Etiqueta (ej. Oficina)"
                      className="w-28 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input type="text" value={d.direccion} onChange={e => setDireccionField(di, 'direccion', e.target.value)}
                      placeholder="Dirección completa"
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    {direcciones.length > 1 && (
                      <button type="button" onClick={() => removeDireccion(di)} className="text-red-400 hover:text-red-600 shrink-0">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Contactos de esta dirección */}
                  <div className="pl-3 border-l-2 border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Contactos de esta dirección</span>
                      <button type="button" onClick={() => addContactoDir(di)}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                        <Plus size={11} /> Agregar
                      </button>
                    </div>
                    {d.contactos.map((c, ci) => (
                      <div key={ci} className="grid grid-cols-4 gap-1.5 items-center">
                        <input type="text" value={c.nombre} onChange={e => setContactoDir(di, ci, 'nombre', e.target.value)}
                          placeholder="Nombre"
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <input type="text" value={c.puesto ?? ''} onChange={e => setContactoDir(di, ci, 'puesto', e.target.value)}
                          placeholder="Puesto"
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <input type="text" value={c.telefono ?? ''} onChange={e => setContactoDir(di, ci, 'telefono', e.target.value)}
                          placeholder="Teléfono"
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <div className="flex gap-1">
                          <input type="email" value={c.email ?? ''} onChange={e => setContactoDir(di, ci, 'email', e.target.value)}
                            placeholder="Correo"
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <button type="button" onClick={() => removeContactoDir(di, ci)} className="text-red-400 hover:text-red-600 shrink-0">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contactos generales (con fiscal) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Contactos generales</label>
                <span className="ml-2 text-xs text-gray-400">— marca ⭐ al contacto fiscal</span>
              </div>
              <button type="button" onClick={() => setContactos(prev => [...prev, contactoVacio()])}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <Plus size={13} /> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {contactos.map((c, i) => (
                <div key={i} className={`rounded-lg border p-2 ${c.es_fiscal ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}>
                  <div className="grid grid-cols-4 gap-2">
                    <input type="text" value={c.nombre} onChange={e => setContacto(i, 'nombre', e.target.value)} placeholder="Nombre"
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input type="text" value={c.puesto ?? ''} onChange={e => setContacto(i, 'puesto', e.target.value)} placeholder="Puesto"
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input type="text" value={c.telefono ?? ''} onChange={e => setContacto(i, 'telefono', e.target.value)} placeholder="Teléfono"
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input type="email" value={c.email ?? ''} onChange={e => setContacto(i, 'email', e.target.value)} placeholder="Correo"
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 px-0.5">
                    <button type="button" onClick={() => marcarFiscal(i)}
                      className={`flex items-center gap-1 text-xs rounded px-2 py-0.5 transition-colors ${c.es_fiscal ? 'bg-amber-400 text-white font-medium' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}>
                      ⭐ {c.es_fiscal ? 'Contacto fiscal' : 'Marcar como fiscal'}
                    </button>
                    {contactos.length > 1 && (
                      <button type="button" onClick={() => setContactos(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
          <button form="cliente-form" type="submit" disabled={loading}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

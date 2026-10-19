'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ArrowUpDown, Users, Phone, Mail, MapPin } from 'lucide-react'
import type { Cliente } from '@/types'
import { borrar } from '@/lib/api-cliente'
import ClienteModal from './ClienteModal'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { BotonIcono, BotonPrincipal, Buscador, EncabezadoPagina, EstadoVacio, Segmentado } from '@/components/ui/Pagina'

type Orden = 'id_asc' | 'id_desc' | 'nombre_az' | 'poliza'

interface Props {
  clientes: Cliente[]
  nivel: number
  esContador: boolean
}

export default function ClientesClient({ clientes: inicial, nivel, esContador }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>(inicial)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ open: boolean; cliente: Cliente | null }>({ open: false, cliente: null })
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [orden, setOrden] = useState<Orden>('id_asc')

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    let lista = clientes.filter((c) =>
      c.nombre.toLowerCase().includes(q) ||
      c.id.toString().includes(q) ||
      (c.rfc?.toLowerCase().includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    )
    switch (orden) {
      case 'id_desc':   lista = [...lista].sort((a, b) => b.id - a.id); break
      case 'nombre_az': lista = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); break
      case 'poliza':    lista = [...lista].sort((a, b) => (b.tiene_poliza ? 1 : 0) - (a.tiene_poliza ? 1 : 0)); break
      default:          lista = [...lista].sort((a, b) => a.id - b.id)
    }
    return lista
  }, [clientes, busqueda, orden])

  async function eliminar(id: number) {
    if (!(await confirmar({ titulo: '¿Eliminar este cliente?', mensaje: 'Esta acción no se puede deshacer.', peligro: true }))) return
    if (!(await borrar(`/api/clientes/${id}`, 'No se pudo eliminar el cliente'))) return
    setClientes((prev) => prev.filter((c) => c.id !== id))
  }

  function toggleExpand(key: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function onGuardado(cliente: Cliente) {
    setClientes((prev) => {
      const idx = prev.findIndex((c) => c.id === cliente.id)
      if (idx >= 0) { const arr = [...prev]; arr[idx] = cliente; return arr }
      return [cliente, ...prev]
    })
    setModal({ open: false, cliente: null })
    aviso.exito(`Cliente ${cliente.nombre} guardado`)
  }

  const puedeEditar    = nivel <= 2
  const puedeEliminar  = nivel <= 1
  const verDescuento   = nivel <= 1
  const verFiscal      = nivel <= 1 || esContador
  const gridTemplate = ['3rem', '1fr', verDescuento && '5.5rem', verFiscal && '7rem', verFiscal && '5rem', '14rem', '5rem'].filter(Boolean).join(' ')

  const ordenOpciones: { value: Orden; label: string }[] = [
    { value: 'id_asc',    label: 'ID ↑' },
    { value: 'id_desc',   label: 'ID ↓' },
    { value: 'nombre_az', label: 'A → Z' },
    { value: 'poliza',    label: 'Póliza primero' },
  ]

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Clientes"
        subtitulo={`${filtrados.length} de ${clientes.length} cliente${clientes.length === 1 ? '' : 's'}`}
        acciones={puedeEditar && (
          <BotonPrincipal onClick={() => setModal({ open: true, cliente: null })}>
            <Plus size={17} /> <span>Nuevo cliente</span>
          </BotonPrincipal>
        )}
      />

      {/* Búsqueda + Orden */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por ID, nombre, RFC o correo…" className="flex-1" />
        <Segmentado opciones={ordenOpciones} valor={orden} onCambio={setOrden} etiqueta={<ArrowUpDown size={13} />} />
      </div>

      {filtrados.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EstadoVacio icono={<Users size={22} />} titulo="No se encontraron clientes"
            descripcion={busqueda ? `Ningún cliente coincide con “${busqueda}”.` : 'Aún no hay clientes registrados.'} />
        </div>
      )}

      {/* Celular y tableta: tarjetas */}
      <div className="space-y-3 lg:hidden">
        {filtrados.map((cliente) => (
          <TarjetaCliente key={cliente.id} cliente={cliente} verDescuento={verDescuento} verFiscal={verFiscal}
            puedeEditar={puedeEditar} puedeEliminar={puedeEliminar}
            onEditar={() => setModal({ open: true, cliente })} onEliminar={() => eliminar(cliente.id)} />
        ))}
      </div>

      {/* Escritorio: tabla */}
      <div className={`hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm shadow-black/[0.02] ${filtrados.length ? 'lg:block' : ''}`}>
        {/* Encabezado */}
        <div className="grid border-b border-gray-200 bg-gray-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500" style={{ gridTemplateColumns: gridTemplate }}>
          <div>ID</div>
          <div>Nombre / Razón social</div>
          {verDescuento && <div className="text-center">Desc.</div>}
          {verFiscal && <div>Régimen</div>}
          {verFiscal && <div>CFDI</div>}
          <div>Direcciones y contactos</div>
          <div className="text-right">Acc.</div>
        </div>

        <div className="divide-y divide-gray-100">
          {filtrados.map((cliente) => {
            const dirs = cliente.direcciones?.length > 0
              ? cliente.direcciones
              : cliente.direccion
                ? [{ etiqueta: 'Principal', direccion: cliente.direccion, contactos: [] }]
                : []

            const contactosGral = cliente.contactos?.filter(c => c.nombre || c.email) ?? []

            return (
              <div key={cliente.id} className="grid items-start px-4 py-3.5 transition-colors hover:bg-gray-50" style={{ gridTemplateColumns: gridTemplate }}>

                {/* ID */}
                <div className="pt-0.5 font-mono text-xs font-semibold text-brand-700">#{cliente.id}</div>

                {/* Nombre */}
                <div className="min-w-0 pt-0.5 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 text-sm">{cliente.nombre}</p>
                    {cliente.tiene_poliza && (
                      <span className="shrink-0 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Póliza</span>
                    )}
                  </div>
                  {cliente.rfc && (
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">RFC: {cliente.rfc}</p>
                  )}
                  {cliente.notas && (
                    <p className="text-xs text-gray-400 mt-1 italic leading-tight">{cliente.notas}</p>
                  )}
                </div>

                {/* Descuento */}
                {verDescuento && (
                  <div className="text-center pt-0.5">
                    {cliente.descuento !== 0 ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        cliente.descuento > 0 ? 'bg-brand-50 text-brand-700' : 'bg-orange-50 text-orange-700'
                      }`}>
                        {cliente.descuento > 0 ? '+' : ''}{cliente.descuento}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                )}

                {/* Régimen fiscal */}
                {verFiscal && (
                  <div className="text-xs text-gray-600 pt-0.5">
                    {cliente.regimen_fiscal ?? <span className="text-gray-300">—</span>}
                  </div>
                )}

                {/* CFDI */}
                {verFiscal && (
                  <div className="text-xs text-gray-600 font-mono pt-0.5">
                    {cliente.uso_cfdi ?? <span className="text-gray-300">—</span>}
                  </div>
                )}

                {/* Direcciones — expansión inline dentro de la columna */}
                <div className="space-y-1.5">
                  {dirs.length === 0 && contactosGral.length === 0 && (
                    <span className="text-xs text-gray-300">Sin información</span>
                  )}

                  {dirs.map((d, i) => {
                    const key = `${cliente.id}-${i}`
                    const expandido = expandidos.has(key)
                    // Principal (i===0): muestra sus contactos + los contactos generales del cliente
                    // Secundarias: solo sus propios contactos
                    const contactosDir = d.contactos?.filter(c => c.nombre || c.email) ?? []
                    const contactosMostrar = i === 0
                      ? [
                          ...contactosGral,
                          ...contactosDir.filter(cd =>
                            !contactosGral.some(cg => cg.email && cg.email === cd.email && cg.nombre === cd.nombre)
                          )
                        ]
                      : contactosDir

                    return (
                      <div key={i}>
                        <button
                          onClick={() => toggleExpand(key)}
                          className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 w-full text-left font-medium"
                        >
                          {expandido ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          {d.etiqueta || `Dir. ${i + 1}`}
                        </button>

                        {expandido && (
                          <div className="mt-1 ml-3 pl-2 border-l-2 border-brand-200 space-y-1.5">
                            {d.direccion && (
                              <p className="text-xs text-gray-600 leading-snug">{d.direccion}</p>
                            )}
                            {contactosMostrar.map((c, ci) => (
                              <div key={ci} className="text-xs space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {c.es_fiscal && (
                                    <span className="bg-amber-100 text-amber-700 px-1 py-0.5 rounded text-[10px] font-semibold">⭐ Fiscal</span>
                                  )}
                                  {c.nombre && <span className="font-medium text-gray-800">{c.nombre}</span>}
                                  {c.puesto && <span className="text-gray-400">{c.puesto}</span>}
                                </div>
                                {c.es_fiscal && cliente.rfc && (
                                  <div className="text-amber-700 font-mono pl-0.5 font-medium">RFC: {cliente.rfc}</div>
                                )}
                                {c.telefono && <div className="text-gray-500 pl-0.5">📞 {c.telefono}</div>}
                                {c.email && <div className="text-gray-500 pl-0.5">✉️ {c.email}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Acciones */}
                <div className="-mt-1 flex items-center justify-end gap-0.5">
                  {puedeEditar && (
                    <BotonIcono titulo="Editar" tono="marca" onClick={() => setModal({ open: true, cliente })}>
                      <Pencil size={15} />
                    </BotonIcono>
                  )}
                  {puedeEliminar && (
                    <BotonIcono titulo="Eliminar" tono="peligro" onClick={() => eliminar(cliente.id)}>
                      <Trash2 size={15} />
                    </BotonIcono>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modal.open && (
        <ClienteModal
          cliente={modal.cliente}
          onClose={() => setModal({ open: false, cliente: null })}
          onGuardado={onGuardado}
        />
      )}
    </div>
  )
}

// ── Tarjeta para celular ──────────────────────────────────────────────────

function TarjetaCliente({ cliente, verDescuento, verFiscal, puedeEditar, puedeEliminar, onEditar, onEliminar }: {
  cliente: Cliente
  verDescuento: boolean
  verFiscal: boolean
  puedeEditar: boolean
  puedeEliminar: boolean
  onEditar: () => void
  onEliminar: () => void
}) {
  const dirs = cliente.direcciones?.length > 0
    ? cliente.direcciones
    : cliente.direccion ? [{ etiqueta: 'Principal', direccion: cliente.direccion, contactos: [] }] : []

  // Contactos generales + los de cada dirección, sin repetir
  const vistos = new Set<string>()
  const contactos = [...(cliente.contactos ?? []), ...dirs.flatMap((d) => d.contactos ?? [])]
    .filter((c) => c.nombre || c.email || c.telefono)
    .filter((c) => {
      const clave = `${c.nombre ?? ''}|${c.email ?? ''}|${c.telefono ?? ''}`
      if (vistos.has(clave)) return false
      vistos.add(clave)
      return true
    })

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm shadow-black/[0.02]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-brand-700">#{cliente.id}</span>
            {cliente.tiene_poliza && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">Póliza</span>}
            {verDescuento && cliente.descuento !== 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cliente.descuento > 0 ? 'bg-brand-50 text-brand-700' : 'bg-orange-50 text-orange-700'}`}>
                {cliente.descuento > 0 ? '+' : ''}{cliente.descuento}%
              </span>
            )}
          </div>
          <h3 className="mt-1 font-semibold leading-snug text-gray-900">{cliente.nombre}</h3>
          {cliente.rfc && <p className="mt-0.5 font-mono text-xs text-gray-500">RFC {cliente.rfc}</p>}
          {verFiscal && (cliente.regimen_fiscal || cliente.uso_cfdi) && (
            <p className="mt-0.5 text-xs text-gray-500">
              {cliente.regimen_fiscal && <>Régimen {cliente.regimen_fiscal}</>}
              {cliente.regimen_fiscal && cliente.uso_cfdi && ' · '}
              {cliente.uso_cfdi && <>CFDI {cliente.uso_cfdi}</>}
            </p>
          )}
        </div>
        {(puedeEditar || puedeEliminar) && (
          <div className="-mr-2 -mt-1 flex shrink-0">
            {puedeEditar && <BotonIcono titulo="Editar" tono="marca" onClick={onEditar}><Pencil size={16} /></BotonIcono>}
            {puedeEliminar && <BotonIcono titulo="Eliminar" tono="peligro" onClick={onEliminar}><Trash2 size={16} /></BotonIcono>}
          </div>
        )}
      </div>

      {contactos.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {contactos.slice(0, 3).map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-800">
                  {c.nombre || c.email}
                  {c.es_fiscal && <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700">Fiscal</span>}
                </p>
                {c.puesto && <p className="truncate text-xs text-gray-400">{c.puesto}</p>}
              </div>
              {c.telefono && (
                <a href={`tel:${c.telefono.replace(/[^\d+]/g, '')}`} aria-label={`Llamar a ${c.nombre || c.telefono}`}
                  className="rounded-lg bg-brand-50 p-2 text-brand-700 active:bg-brand-100"><Phone size={15} /></a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} aria-label={`Escribir a ${c.email}`}
                  className="rounded-lg bg-brand-50 p-2 text-brand-700 active:bg-brand-100"><Mail size={15} /></a>
              )}
            </li>
          ))}
          {contactos.length > 3 && <li className="text-xs text-gray-400">+{contactos.length - 3} contacto(s) más</li>}
        </ul>
      )}

      {dirs.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
          {dirs.map((d, i) => d.direccion && (
            <li key={i}>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.direccion)}`}
                target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-sm text-gray-600 active:text-brand-700">
                <MapPin size={15} className="mt-0.5 shrink-0 text-gray-400" />
                <span className="min-w-0">
                  {dirs.length > 1 && <span className="font-medium text-gray-800">{d.etiqueta || `Dirección ${i + 1}`}: </span>}
                  {d.direccion}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {cliente.notas && <p className="mt-3 text-xs italic text-gray-400">{cliente.notas}</p>}
    </article>
  )
}

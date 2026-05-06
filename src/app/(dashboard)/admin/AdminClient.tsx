'use client'

import { useState } from 'react'
import { Pencil, Plus, Settings, Trash2, Users } from 'lucide-react'
import type { Usuario, Configuracion } from '@/types'

interface Props {
  usuarios: Usuario[]
  config: Configuracion | null
}

const nivelLabel: Record<number, string> = {
  0: 'Admin',
  1: 'Admin',
  2: 'Estándar',
  3: 'Restringido',
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function AdminClient({ usuarios: inicial, config: configInicial }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(inicial)
  const [config, setConfig] = useState(configInicial)
  const [tab, setTab] = useState<'usuarios' | 'config'>('usuarios')

  // ── Config ──────────────────────────────────────────────────
  const [iva, setIva] = useState(config?.iva_porcentaje?.toString() ?? '16')
  const [empNombre,    setEmpNombre]    = useState(config?.empresa_nombre    ?? 'DIDARA TI')
  const [empDireccion, setEmpDireccion] = useState(config?.empresa_direccion ?? '')
  const [empTelefono,  setEmpTelefono]  = useState(config?.empresa_telefono  ?? '')
  const [empEmail,     setEmpEmail]     = useState(config?.empresa_email     ?? '')
  const [empWeb,       setEmpWeb]       = useState(config?.empresa_web       ?? '')
  const [pagoBanco,    setPagoBanco]    = useState(config?.pago_banco    ?? '')
  const [pagoCuenta,   setPagoCuenta]   = useState(config?.pago_cuenta   ?? '')
  const [pagoClabe,    setPagoClabe]    = useState(config?.pago_clabe    ?? '')
  const [pagoTitular,  setPagoTitular]  = useState(config?.pago_titular  ?? '')
  const [pagoMostrar,  setPagoMostrar]  = useState(config?.pago_mostrar  ?? true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configMsg,    setConfigMsg]    = useState('')

  // ── Nuevo usuario ────────────────────────────────────────────
  const [modalUsuario, setModalUsuario] = useState(false)
  const [nuevoUser, setNuevoUser] = useState({
    username: '', password: '', nombre: '', correo: '', nivel: '2', es_contador: false,
  })
  const [savingUser, setSavingUser] = useState(false)
  const [userError,  setUserError]  = useState('')

  // ── Editar usuario ───────────────────────────────────────────
  const [modalEditUser, setModalEditUser] = useState<Usuario | null>(null)
  const [editUser, setEditUser] = useState({
    nombre: '', nivel: '2', es_contador: false, correo: '', nueva_contrasena: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError,  setEditError]  = useState('')

  // ── Handlers ─────────────────────────────────────────────────

  async function guardarConfig(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSavingConfig(true)
    setConfigMsg('')
    try {
      const res = await fetch('/api/admin/configuracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iva_porcentaje:   parseFloat(iva),
          empresa_nombre:    empNombre,
          empresa_direccion: empDireccion,
          empresa_telefono:  empTelefono,
          empresa_email:     empEmail,
          empresa_web:       empWeb,
          pago_banco:    pagoBanco    || null,
          pago_cuenta:   pagoCuenta   || null,
          pago_clabe:    pagoClabe    || null,
          pago_titular:  pagoTitular  || null,
          pago_mostrar:  pagoMostrar,
        }),
      })
      const json = await res.json()
      if (!res.ok) return setConfigMsg(`Error: ${json.error}`)
      setConfig(json.data)
      setConfigMsg('Configuración guardada.')
    } catch {
      setConfigMsg('Error de red. Intenta de nuevo.')
    } finally {
      setSavingConfig(false)
    }
  }

  async function crearUsuario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSavingUser(true)
    setUserError('')
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevoUser, nivel: parseInt(nuevoUser.nivel) }),
      })
      const json = await res.json()
      if (!res.ok) return setUserError(json.error ?? 'Error al crear usuario')
      setUsuarios((prev) => [...prev, json.data])
      setModalUsuario(false)
      setNuevoUser({ username: '', password: '', nombre: '', correo: '', nivel: '2', es_contador: false })
    } catch {
      setUserError('Error de red. Intenta de nuevo.')
    } finally {
      setSavingUser(false)
    }
  }

  function abrirEditUser(u: Usuario) {
    setModalEditUser(u)
    setEditUser({
      nombre: u.nombre,
      nivel: String(u.nivel),
      es_contador: (u as unknown as { es_contador: boolean }).es_contador ?? false,
      correo: u.correo ?? '',
      nueva_contrasena: '',
    })
    setEditError('')
  }

  async function guardarEditUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!modalEditUser) return
    setSavingEdit(true)
    setEditError('')
    const body: Record<string, unknown> = {
      nombre:      editUser.nombre,
      nivel:       parseInt(editUser.nivel),
      es_contador: editUser.es_contador,
      correo:      editUser.correo,
    }
    if (editUser.nueva_contrasena) body.nueva_contrasena = editUser.nueva_contrasena
    try {
      const res = await fetch(`/api/admin/usuarios/${modalEditUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) return setEditError(json.error ?? 'Error al editar usuario')
      setUsuarios((prev) => prev.map((u) => (u.id === modalEditUser.id ? json.data : u)))
      setModalEditUser(null)
    } catch {
      setEditError('Error de red. Intenta de nuevo.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function desactivarUsuario(u: Usuario) {
    if (!window.confirm(`¿Desactivar a "${u.nombre}"? No podrá iniciar sesión hasta que sea reactivado.`)) return
    const res = await fetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) return alert(json.error ?? 'Error al desactivar usuario')
    setUsuarios((prev) => prev.map((usr) => (usr.id === u.id ? json.data : usr)))
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['usuarios', 'config'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t === 'usuarios' ? <Users size={15} /> : <Settings size={15} />}
            {t === 'usuarios' ? 'Usuarios' : 'Configuración'}
          </button>
        ))}
      </div>

      {/* ── Usuarios ── */}
      {tab === 'usuarios' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setModalUsuario(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} />
              Nuevo usuario
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Correo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nivel</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.nombre}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{u.username ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.correo ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        Number(u.nivel) <= 1
                          ? 'bg-blue-100 text-blue-700'
                          : Number(u.nivel) === 2
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {nivelLabel[Number(u.nivel)]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {(u as unknown as { es_contador: boolean }).es_contador ? 'Contador' : 'Estándar'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => abrirEditUser(u)}
                          title="Editar usuario"
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        {u.activo && (
                          <button
                            onClick={() => desactivarUsuario(u)}
                            title="Desactivar usuario"
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Configuración ── */}
      {tab === 'config' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
          <h2 className="font-semibold text-gray-900 mb-5">Configuración general</h2>
          <form onSubmit={guardarConfig} className="space-y-6">

            {/* Sistema */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">
                Sistema
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IVA por defecto (%)</label>
                <input
                  type="number" min="0" max="100" step="0.01"
                  value={iva} onChange={(e) => setIva(e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Valor predeterminado en cotizaciones e inventario.
                </p>
              </div>
            </div>

            {/* Datos empresa */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">
                Datos de la empresa
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={empNombre} onChange={(e) => setEmpNombre(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <textarea
                  rows={2} value={empDireccion}
                  onChange={(e) => setEmpDireccion(e.target.value)}
                  className={inputCls + ' resize-none'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="text" value={empTelefono} onChange={(e) => setEmpTelefono(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
                <input type="text" value={empWeb} onChange={(e) => setEmpWeb(e.target.value)} className={inputCls} placeholder="www.ejemplo.com" />
              </div>
            </div>

            {/* Datos de pago (PDF) */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">
                Datos de pago en PDFs
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pagoMostrar}
                  onChange={(e) => setPagoMostrar(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Mostrar sección de pago en cotizaciones y reportes PDF</span>
              </label>
              {pagoMostrar && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                      <input type="text" value={pagoBanco} onChange={(e) => setPagoBanco(e.target.value)} className={inputCls} placeholder="Ej. BBVA" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Número de cuenta</label>
                      <input type="text" value={pagoCuenta} onChange={(e) => setPagoCuenta(e.target.value)} className={inputCls} placeholder="Ej. 0480939986" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CLABE interbancaria</label>
                    <input type="text" value={pagoClabe} onChange={(e) => setPagoClabe(e.target.value)} className={inputCls} placeholder="18 dígitos" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titular de la cuenta</label>
                    <input type="text" value={pagoTitular} onChange={(e) => setPagoTitular(e.target.value)} className={inputCls} placeholder="Nombre completo del titular" />
                  </div>
                </div>
              )}
            </div>

            {configMsg && (
              <p className={`text-sm ${configMsg.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {configMsg}
              </p>
            )}
            <button
              type="submit" disabled={savingConfig}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
            >
              {savingConfig ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </form>
        </div>
      )}

      {/* ── Modal nuevo usuario ── */}
      {modalUsuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Nuevo usuario</h2>
              <button onClick={() => setModalUsuario(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={crearUsuario} className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={nuevoUser.nombre} onChange={(e) => setNuevoUser((u) => ({ ...u, nombre: e.target.value }))} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de usuario *</label>
                <input type="text" value={nuevoUser.username} onChange={(e) => setNuevoUser((u) => ({ ...u, username: e.target.value }))} required placeholder="ej: pablo_garcia" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                <input type="password" value={nuevoUser.password} onChange={(e) => setNuevoUser((u) => ({ ...u, password: e.target.value }))} required minLength={8} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo de notificaciones</label>
                <input type="email" value={nuevoUser.correo} onChange={(e) => setNuevoUser((u) => ({ ...u, correo: e.target.value }))} placeholder="ejemplo@correo.com" className={inputCls} />
                <p className="text-xs text-gray-400 mt-1">Opcional. Para recibir notificaciones del sistema.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de acceso</label>
                <select value={nuevoUser.nivel} onChange={(e) => setNuevoUser((u) => ({ ...u, nivel: e.target.value }))} className={inputCls}>
                  <option value="1">Admin (nivel 1)</option>
                  <option value="2">Estándar (nivel 2)</option>
                  <option value="3">Restringido (nivel 3)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={nuevoUser.es_contador} onChange={(e) => setNuevoUser((u) => ({ ...u, es_contador: e.target.checked }))} className="rounded border-gray-300 text-blue-600" />
                <span className="text-sm text-gray-700">Es contador (recibe correos de factura, ve IVA)</span>
              </label>
              {userError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{userError}</div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalUsuario(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
                <button type="submit" disabled={savingUser} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg">{savingUser ? 'Creando...' : 'Crear usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal editar usuario ── */}
      {modalEditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Editar usuario</h2>
              <button onClick={() => setModalEditUser(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={guardarEditUser} className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text" required value={editUser.nombre}
                  onChange={(e) => setEditUser((u) => ({ ...u, nombre: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo de notificaciones</label>
                <input
                  type="email" value={editUser.correo}
                  onChange={(e) => setEditUser((u) => ({ ...u, correo: e.target.value }))}
                  placeholder="ejemplo@correo.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de acceso</label>
                <select
                  value={editUser.nivel}
                  onChange={(e) => setEditUser((u) => ({ ...u, nivel: e.target.value }))}
                  className={inputCls}
                >
                  <option value="1">Admin (nivel 1)</option>
                  <option value="2">Estándar (nivel 2)</option>
                  <option value="3">Restringido (nivel 3)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={editUser.es_contador}
                  onChange={(e) => setEditUser((u) => ({ ...u, es_contador: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Es contador</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <input
                  type="password" value={editUser.nueva_contrasena} minLength={8}
                  onChange={(e) => setEditUser((u) => ({ ...u, nueva_contrasena: e.target.value }))}
                  placeholder="Dejar en blanco para no cambiar"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres. Solo si el usuario olvidó su contraseña.</p>
              </div>
              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{editError}</div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalEditUser(null)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
                <button type="submit" disabled={savingEdit} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg">{savingEdit ? 'Guardando...' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

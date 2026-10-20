'use client'

import { useEffect, useState } from 'react'
import { BellRing, Laptop, Smartphone, Trash2 } from 'lucide-react'
import { aviso, confirmar } from '@/components/ui/Avisos'
import { BotonIcono } from '@/components/ui/Pagina'

interface Dispositivo { id: number; usuario_id: string; usuario: string; dispositivo: string | null; created_at: string }

const esCelular = (d: string | null) => /Android|iPhone|iPad/.test(d ?? '')

/** Qué celulares y computadoras reciben los avisos push de cada persona */
export default function DispositivosAvisos() {
  const [lista, setLista] = useState<Dispositivo[] | null>(null)

  useEffect(() => {
    fetch('/api/push/dispositivos').then((r) => r.json()).then((j) => setLista(j.data ?? [])).catch(() => setLista([]))
  }, [])

  async function quitar(d: Dispositivo) {
    if (!(await confirmar({
      titulo: `¿Quitar avisos de ${d.dispositivo ?? 'este dispositivo'}?`,
      mensaje: `Dejará de recibir los avisos de ${d.usuario} hasta que vuelva a activarlos desde la Mesa de ayuda.`,
      textoConfirmar: 'Quitar', peligro: true,
    }))) return
    const r = await fetch(`/api/push/dispositivos?id=${d.id}`, { method: 'DELETE' })
    if (!r.ok) return aviso.error('No se pudo quitar')
    setLista((p) => (p ?? []).filter((x) => x.id !== d.id))
    aviso.exito('Dispositivo quitado')
  }

  // Agrupado por persona
  const porUsuario = new Map<string, Dispositivo[]>()
  for (const d of lista ?? []) {
    if (!porUsuario.has(d.usuario)) porUsuario.set(d.usuario, [])
    porUsuario.get(d.usuario)!.push(d)
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-3">
        <BellRing size={18} className="mt-0.5 shrink-0 text-brand-600" />
        <div>
          <h3 className="font-semibold text-gray-900">Dispositivos con avisos</h3>
          <p className="text-xs text-gray-500">
            Cada celular o computadora recibe los avisos de quien los activó con su sesión. Si cierra sesión, deja de recibirlos;
            si otra persona inicia sesión ahí con avisos ya permitidos, pasan a ser de ella.
          </p>
        </div>
      </div>
      {!lista ? (
        <p className="px-4 py-6 text-sm text-gray-400">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-400">Nadie ha activado avisos todavía. Se activan en Mesa de ayuda → “Activar avisos”.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {[...porUsuario.entries()].map(([usuario, dispositivos]) => (
            <li key={usuario} className="px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{usuario}</p>
              <ul className="mt-1.5 space-y-1">
                {dispositivos.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm text-gray-600">
                    {esCelular(d.dispositivo) ? <Smartphone size={15} className="text-gray-400" /> : <Laptop size={15} className="text-gray-400" />}
                    <span className="flex-1">{d.dispositivo ?? 'Dispositivo'}</span>
                    <span className="text-xs text-gray-400">
                      desde {new Date(d.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                    <BotonIcono titulo="Quitar avisos de este dispositivo" tono="peligro" onClick={() => quitar(d)}><Trash2 size={14} /></BotonIcono>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

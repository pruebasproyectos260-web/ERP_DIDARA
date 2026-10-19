'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function FirmaForm() {
  const searchParams = useSearchParams()
  const reporteId = searchParams.get('id')
  const token = searchParams.get('t')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dibujando, setDibujando] = useState(false)
  const [vacio, setVacio] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')
  const [reporte, setReporte] = useState<{ folio: string; cliente: string; equipo: string; firmado: boolean } | null>(null)
  const [enlaceInvalido, setEnlaceInvalido] = useState('')

  useEffect(() => {
    if (!reporteId || !token) return
    fetch(`/api/firma/${reporteId}?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) return setEnlaceInvalido(j.error ?? 'Enlace de firma no válido.')
        setReporte(j.data)
      })
      .catch(() => setEnlaceInvalido('No se pudo cargar el reporte. Revisa tu conexión.'))
  }, [reporteId, token])

  // El canvas mide 380×180 internamente pero se muestra al ancho de la pantalla:
  // hay que escalar las coordenadas del dedo/mouse para que el trazo caiga donde se toca.
  function posicion(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const punto = 'touches' in e ? e.touches[0] : e
    return {
      x: (punto.clientX - rect.left) * (canvas.width / rect.width),
      y: (punto.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function iniciar(e: React.MouseEvent | React.TouchEvent) {
    setDibujando(true)
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const { x, y } = posicion(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function dibujar(e: React.MouseEvent | React.TouchEvent) {
    if (!dibujando) return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const { x, y } = posicion(e, canvas)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1e293b'
    ctx.lineTo(x, y)
    ctx.stroke()
    setVacio(false)
  }

  function limpiar() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setVacio(true)
  }

  async function enviar() {
    if (vacio) return setError('Por favor dibuja tu firma')
    if (!reporteId) return setError('ID de reporte no válido')

    setEnviando(true)
    setError('')

    const canvas = canvasRef.current!
    const firmaBase64 = canvas.toDataURL('image/png')

    try {
      const res = await fetch(`/api/firma/${reporteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, firma: firmaBase64 }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        return setError(json.error ?? 'Error al guardar la firma')
      }
      setExito(true)
    } catch {
      setError('Error de red. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (!reporteId || !token || enlaceInvalido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p className="text-gray-500 text-center">{enlaceInvalido || 'Enlace de firma no válido.'}</p>
      </div>
    )
  }

  if (reporte?.firmado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Reporte ya firmado</h2>
          <p className="text-gray-600 text-sm">
            La conformidad del reporte {reporte.folio} ya fue registrada. ¡Gracias!
          </p>
        </div>
      </div>
    )
  }

  if (exito) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">¡Firma recibida!</h2>
          <p className="text-gray-600 text-sm">
            Gracias. Tu conformidad ha sido registrada. El equipo ha sido marcado como entregado.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 text-center">
          <h1 className="text-xl font-bold text-gray-900">
            Didara<span className="text-blue-500">TI</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Firma de conformidad</p>
        </div>

        {/* Info reporte */}
        {reporte && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Reporte:</span> {reporte.folio}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Cliente:</span> {reporte.cliente}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Equipo:</span> {reporte.equipo}
            </p>
          </div>
        )}

        {/* Canvas */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700 mb-3 text-center">
            Por favor firma en el área de abajo para confirmar la recepción de tu equipo
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
            <canvas
              ref={canvasRef}
              width={380}
              height={180}
              className="w-full cursor-crosshair touch-none"
              onMouseDown={iniciar}
              onMouseMove={dibujar}
              onMouseUp={() => setDibujando(false)}
              onMouseLeave={() => setDibujando(false)}
              onTouchStart={iniciar}
              onTouchMove={dibujar}
              onTouchEnd={() => setDibujando(false)}
            />
          </div>
          <button
            onClick={limpiar}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Borrar y volver a firmar
          </button>
        </div>

        {error && (
          <div className="mx-6 mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <div className="px-6 pb-6">
          <button
            onClick={enviar}
            disabled={enviando || vacio}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl text-sm transition-colors"
          >
            {enviando ? 'Enviando...' : 'Confirmar recepción'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FirmaClientePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <FirmaForm />
    </Suspense>
  )
}

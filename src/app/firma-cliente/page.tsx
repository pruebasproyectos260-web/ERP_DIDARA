'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function FirmaForm() {
  const searchParams = useSearchParams()
  const reporteId = searchParams.get('id')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dibujando, setDibujando] = useState(false)
  const [vacio, setVacio] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')
  const [reporte, setReporte] = useState<{ folio: string; cliente: { nombre: string }; equipo: string } | null>(null)

  useEffect(() => {
    if (!reporteId) return
    fetch(`/api/reportes/${reporteId}`)
      .then((r) => r.json())
      .then((j) => setReporte(j.data))
  }, [reporteId])

  function iniciar(e: React.MouseEvent | React.TouchEvent) {
    setDibujando(true)
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function dibujar(e: React.MouseEvent | React.TouchEvent) {
    if (!dibujando) return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
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

    const res = await fetch(`/api/reportes/${reporteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firma_cliente: firmaBase64,
        firma_fecha: new Date().toISOString(),
        estado: 'entregado',
      }),
    })

    setEnviando(false)
    if (!res.ok) {
      const json = await res.json()
      return setError(json.error ?? 'Error al guardar la firma')
    }
    setExito(true)
  }

  if (!reporteId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Enlace de firma no válido.</p>
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
              <span className="font-medium">Cliente:</span> {reporte.cliente?.nombre}
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

'use client'

import { createElement } from 'react'
import {
  AppWindow, Building2, Bus, Car, Ellipsis, FileText, Fuel, Landmark, Milestone, Package, Paperclip,
  PiggyBank, Receipt, ShieldCheck, Users, UtensilsCrossed, Wrench, Zap, Hammer, CircleDollarSign,
} from 'lucide-react'
import { colorCategoria } from '@/lib/finanzas'

type Icono = React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>

const ICONO: Record<string, Icono> = {
  Combustible: Fuel, Casetas: Milestone, Comida: UtensilsCrossed, Material: Package, Herramienta: Hammer,
  Transporte: Bus, Vehículo: Car, Papelería: Paperclip, Servicios: Zap, Software: AppWindow, Renta: Building2,
  Sueldos: Users, Préstamos: Landmark, Impuestos: Receipt, Otro: Ellipsis,
  Cotización: FileText, Servicio: Wrench, Póliza: ShieldCheck, 'Otro ingreso': PiggyBank,
}

/** Círculo de color con el ícono de la categoría */
export function BurbujaCategoria({ categoria, tamano = 40, className = '' }: { categoria: string; tamano?: number; className?: string }) {
  const color = colorCategoria(categoria)
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: tamano, height: tamano, backgroundColor: `${color}1f`, color }}>
      {createElement(ICONO[categoria] ?? CircleDollarSign, { size: Math.round(tamano * 0.45) })}
    </span>
  )
}

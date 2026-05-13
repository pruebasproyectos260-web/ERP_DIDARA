'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Wrench,
  Calendar,
  TrendingUp,
  Receipt,
  Settings,
  ClipboardList,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import type { NivelUsuario } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  nivelMinimo: number   // nivel máximo de usuario que puede verlo (0=más privilegiado)
  nivelMaximo?: number  // si nivel >= nivelMaximo, NO se muestra
}

const navItems: NavItem[] = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard, nivelMinimo: 0, nivelMaximo: 3 },
  { href: '/clientes',     label: 'Clientes',     icon: Users,           nivelMinimo: 0 },
  { href: '/inventario',   label: 'Inventario',   icon: Package,         nivelMinimo: 0 },
  { href: '/cotizaciones', label: 'Cotizaciones', icon: FileText,        nivelMinimo: 0 },
  { href: '/reportes',     label: 'Reportes',     icon: Wrench,          nivelMinimo: 0 },
  { href: '/agenda',       label: 'Agenda',       icon: Calendar,        nivelMinimo: 0 },
  { href: '/pendientes',   label: 'Pendientes',   icon: ClipboardList,   nivelMinimo: 0 },
  { href: '/software',     label: 'Software',     icon: Monitor,         nivelMinimo: 0 },
  { href: '/ventas',       label: 'Ventas',       icon: TrendingUp,      nivelMinimo: 0, nivelMaximo: 3 },
  { href: '/gastos',       label: 'Gastos',       icon: Receipt,         nivelMinimo: 0, nivelMaximo: 3 },
  { href: '/admin',        label: 'Admin',        icon: Settings,        nivelMinimo: 0, nivelMaximo: 2 },
]

export default function Sidebar({ nivel }: { nivel: number }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)

  const itemsVisibles = navItems.filter((item) => {
    if (item.nivelMaximo !== undefined && nivel >= item.nivelMaximo) return false
    return true
  })

  return (
    <aside
      className={`flex flex-col bg-gray-900 text-white transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-700">
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight text-white">
            Didara<span className="text-blue-400">ERP</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-gray-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {itemsVisibles.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
          Didara TI © {new Date().getFullYear()}
        </div>
      )}
    </aside>
  )
}

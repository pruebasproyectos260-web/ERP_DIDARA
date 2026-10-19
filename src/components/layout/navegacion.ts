import {
  LayoutDashboard, Users, Package, FileText, Wrench, Calendar,
  TrendingUp, Receipt, Settings, ClipboardList, Monitor,
} from 'lucide-react'

export interface ItemNav {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  /** Si el nivel del usuario es >= este valor, el módulo no se muestra */
  ocultarDesdeNivel?: number
}

export interface GrupoNav { titulo: string; items: ItemNav[] }

export const GRUPOS_NAV: GrupoNav[] = [
  { titulo: 'General', items: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, ocultarDesdeNivel: 3 },
  ] },
  { titulo: 'Operación', items: [
    { href: '/clientes',     label: 'Clientes',     icon: Users },
    { href: '/cotizaciones', label: 'Cotizaciones', icon: FileText },
    { href: '/reportes',     label: 'Reportes',     icon: Wrench },
    { href: '/agenda',       label: 'Agenda',       icon: Calendar },
    { href: '/pendientes',   label: 'Pendientes',   icon: ClipboardList },
  ] },
  { titulo: 'Catálogos', items: [
    { href: '/inventario', label: 'Inventario', icon: Package },
    { href: '/software',   label: 'Software',   icon: Monitor },
  ] },
  { titulo: 'Finanzas', items: [
    { href: '/ventas', label: 'Ventas', icon: TrendingUp, ocultarDesdeNivel: 3 },
    { href: '/gastos', label: 'Gastos', icon: Receipt,    ocultarDesdeNivel: 3 },
  ] },
  { titulo: 'Sistema', items: [
    { href: '/admin', label: 'Administración', icon: Settings, ocultarDesdeNivel: 2 },
  ] },
]

export function gruposVisibles(nivel: number): GrupoNav[] {
  return GRUPOS_NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => i.ocultarDesdeNivel === undefined || nivel < i.ocultarDesdeNivel) }))
    .filter((g) => g.items.length > 0)
}

export function itemActivo(pathname: string): ItemNav | undefined {
  return GRUPOS_NAV.flatMap((g) => g.items).find((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
}

export const COOKIE_SIDEBAR = 'sidebar_colapsado'

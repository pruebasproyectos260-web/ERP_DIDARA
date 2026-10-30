import {
  LayoutDashboard, Users, Package, FileText, Wrench, Calendar,
  Wallet, Settings, ClipboardList, Monitor, LifeBuoy, House, CalendarCheck, Truck,
} from 'lucide-react'
import { NIVEL } from '@/lib/nivel'

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
    { href: '/tickets',      label: 'Mesa de ayuda', icon: LifeBuoy },
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
    // Todos registran sus gastos; administración y contabilidad ven todo (ver lib/finanzas.ts)
    { href: '/finanzas', label: 'Finanzas', icon: Wallet },
  ] },
  { titulo: 'Sistema', items: [
    { href: '/admin', label: 'Administración', icon: Settings, ocultarDesdeNivel: 2 },
  ] },
]

/** Transportes de Carga General Vicente Guerrero: solo el super admin (ver app/(dashboard)/transportes) */
export const GRUPOS_NAV_TCG: GrupoNav[] = [
  { titulo: 'Gastos', items: [
    { href: '/transportes/gastos', label: 'Gastos empresa', icon: Wallet },
    { href: '/transportes/hogar',  label: 'Gastos hogar',   icon: House },
  ] },
  { titulo: 'Personal', items: [
    { href: '/transportes/asistencia', label: 'Asistencia', icon: CalendarCheck },
  ] },
  { titulo: 'Flota', items: [
    { href: '/transportes/camiones', label: 'Camiones', icon: Truck },
  ] },
]

/**
 * ¿Se muestra Transportes? (cambia el menú, la marca y los colores). Solo para el super admin:
 * si otro nivel escribe la dirección a mano ve el 404 con el menú normal de Didara.
 */
export const enTransportes = (nivel: number, pathname: string) =>
  nivel === NIVEL.SUPER_ADMIN && (pathname === '/transportes' || pathname.startsWith('/transportes/'))

export function gruposVisibles(nivel: number, pathname = ''): GrupoNav[] {
  if (enTransportes(nivel, pathname)) return GRUPOS_NAV_TCG
  return GRUPOS_NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => i.ocultarDesdeNivel === undefined || nivel < i.ocultarDesdeNivel) }))
    .filter((g) => g.items.length > 0)
}

export function itemActivo(nivel: number, pathname: string): ItemNav | undefined {
  return (enTransportes(nivel, pathname) ? GRUPOS_NAV_TCG : GRUPOS_NAV).flatMap((g) => g.items)
    .find((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
}

export const COOKIE_SIDEBAR = 'sidebar_colapsado'

// ─── Usuarios ───────────────────────────────────────────────────────────────

export type NivelUsuario = 0 | 1 | 2 | 3 | 'contador'

export interface Usuario {
  id: string
  email?: string
  username?: string
  nombre: string
  correo?: string
  nivel: NivelUsuario
  activo: boolean
  created_at: string
}

// ─── Configuración ───────────────────────────────────────────────────────────

export interface Configuracion {
  id: number
  iva_porcentaje: number
  moneda: string
  empresa_nombre: string
  empresa_direccion: string
  empresa_telefono: string
  empresa_email: string
  empresa_web: string
  pago_banco?: string
  pago_cuenta?: string
  pago_clabe?: string
  pago_titular?: string
  pago_mostrar?: boolean
  updated_at: string
  updated_by: string
}

// ─── Clientes ────────────────────────────────────────────────────────────────

export interface Contacto {
  nombre: string
  telefono?: string
  email?: string
  puesto?: string
  es_fiscal?: boolean
}

export interface Direccion {
  etiqueta: string     // 'Principal', 'Oficina', 'Sucursal 1', etc.
  direccion: string
  contactos: Contacto[]
}

export interface Cliente {
  id: number
  nombre: string
  rfc?: string
  direccion?: string       // campo legacy, usar direcciones
  direcciones: Direccion[]
  telefono?: string
  email?: string
  contactos: Contacto[]
  notas?: string
  regimen_fiscal?: string  // ej: '601', '616', '626'
  uso_cfdi?: string        // ej: 'G01', 'G03', 'P01'
  descuento: number        // porcentaje, puede ser negativo
  tiene_poliza: boolean
  activo: boolean
  created_at: string
  updated_at: string
}

// ─── Inventario ───────────────────────────────────────────────────────────────

export interface Producto {
  id: number
  codigo?: string
  nombre: string
  descripcion?: string
  categoria?: string
  categorias?: string          // semicolon-separated: "CCTV;Energía"
  unidad: string
  precio_venta: number
  precio_compra_neto: number
  precio_compra_incluye_iva: boolean
  iva_compra: number           // porcentaje, ej: 16
  precio_compra_con_iva: number // calculado
  stock: number
  stock_minimo: number
  clave_sat_producto?: string  // ej: 46171621
  clave_sat_unidad?: string    // ej: H87
  imagen_url?: string
  activo: boolean
  created_at: string
  updated_at: string
}

// ─── Cotizaciones ─────────────────────────────────────────────────────────────

export type EstadoCotizacion = 'borrador' | 'pendiente' | 'enviada' | 'aprobada' | 'aceptada' | 'rechazada' | 'facturada' | 'cancelada' | 'pagada'

export interface ItemCotizacion {
  id?: number
  tipo: 'producto' | 'servicio' | 'equipo_recuperado'
  descripcion: string
  cantidad: number
  precio_unitario: number
  precio_compra?: number       // costo de compra por unidad
  cantidad_recuperada?: number // unidades recuperadas (costo 0)
  descuento: number            // porcentaje
  subtotal: number
  producto_id?: number
}

export interface Cotizacion {
  id: number
  folio: string
  cliente_id: number
  cliente?: Cliente
  fecha: string
  vigencia?: string
  estado: EstadoCotizacion
  aplica_iva: boolean
  iva_porcentaje: number
  subtotal: number
  iva_monto: number
  total: number
  ganancia_total?: number
  ganancia_real?: number    // override manual de ganancia
  pct_didara?: number       // porcentaje que pertenece a Didara (default 100)
  quien_es_el_cliente?: string
  elaborado_por?: string
  direccion_entrega?: string
  contactos_cotizacion?: Contacto[]
  notas?: string
  condiciones?: string
  items: ItemCotizacion[]
  created_by: string
  created_at: string
  updated_at: string
}

// ─── Reportes de Servicio Técnico ─────────────────────────────────────────────

export type EstadoReporte = 'abierto' | 'en_proceso' | 'completado' | 'entregado' | 'cancelado'

export interface ItemReporte {
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export interface EvidenciaReporte {
  tipo: 'antes' | 'despues' | 'otro'
  descripcion?: string
  urls: string[]
}

export interface Reporte {
  id: number
  folio: string
  cliente_id: number
  cliente?: Cliente
  fecha_ingreso: string
  fecha_entrega?: string
  equipo: string
  marca?: string
  modelo?: string
  serie?: string
  tipo_servicio: string[]
  falla_reportada: string
  diagnostico?: string
  trabajos_realizados: string[]
  trabajo_realizado?: string   // legacy
  observaciones?: string
  direccion_servicio?: string
  evidencias: EvidenciaReporte[]
  estado: EstadoReporte
  items: ItemReporte[]
  subtotal: number
  total: number
  firma_cliente?: string       // URL en Storage
  firma_fecha?: string
  tecnico_id: string
  tecnico?: Usuario
  created_at: string
  updated_at: string
}

// ─── Agenda ───────────────────────────────────────────────────────────────────

export type TipoEvento = 'instalacion' | 'entrega' | 'mantenimiento' | 'compra' | 'pago' | 'reunion' | 'capacitacion' | 'poliza'
export type EstadoEvento = 'Pendiente' | 'En Proceso' | 'Completado' | 'Cancelado'

export interface Evento {
  id: number
  titulo: string
  descripcion?: string
  tipo: TipoEvento
  fecha_inicio: string
  fecha_fin?: string
  todo_el_dia: boolean
  cliente_id?: number
  cliente?: Cliente
  responsable_id: string
  responsables?: string
  lugar?: string
  contacto?: string
  estado?: EstadoEvento
  notas_adicionales?: string
  color?: string
  created_at: string
}

// ─── Ventas ───────────────────────────────────────────────────────────────────

export interface IngresoManual {
  id: number
  fecha: string
  descripcion: string
  monto: number
  notas?: string
  created_at: string
}

export interface GananciaFija {
  id: number
  descripcion: string
  monto: number
  dia?: number        // día del mes en que se cobra
  fecha_inicio?: string  // 'YYYY-MM'
  notas?: string
  created_at: string
}

export interface GananciaFijaRegistro {
  id: number
  ganancia_fija_id: number
  mes_key: string     // 'YYYY-MM'
  monto: number
  created_at: string
}

// ─── Gastos ───────────────────────────────────────────────────────────────────

export interface GastoFijo {
  id: number
  nombre: string
  monto: number
  dia?: number        // día del mes en que se paga
  fecha_inicio?: string  // 'YYYY-MM'
  notas?: string
  created_at: string
}

export interface GastoFijoRegistro {
  id: number
  gasto_fijo_id: number
  mes_key: string     // 'YYYY-MM'
  monto: number
  created_at: string
}

export type TipoGastoVariable = 'Combustible' | 'Comida' | 'Casetas' | 'Transporte' | 'Material' | 'Papelería' | 'Servicios' | string

export interface GastoVariable {
  id: number
  fecha: string
  tipo: TipoGastoVariable
  descripcion?: string
  monto: number
  metodo_pago?: string
  registrado_por?: string
  created_at: string
}

// ─── Pendientes ───────────────────────────────────────────────────────────────

export type EstadoPendiente = 'Pendiente' | 'Completado'

export interface Pendiente {
  id: number
  cliente_id?: number
  cliente_nombre?: string
  contacto_nombre?: string
  tecnico_ids: string[]
  descripcion: string
  fecha_solicitud: string
  fecha_max_entrega?: string
  estado: EstadoPendiente
  created_at: string
  updated_at: string
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
}

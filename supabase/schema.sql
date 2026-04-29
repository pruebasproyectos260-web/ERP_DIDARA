-- ============================================================
-- DIDARA ERP - Schema de Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── CONFIGURACIÓN ──────────────────────────────────────────
CREATE TABLE configuracion (
  id              SERIAL PRIMARY KEY,
  iva_porcentaje  NUMERIC(5,2) NOT NULL DEFAULT 16,
  moneda          VARCHAR(10)  NOT NULL DEFAULT 'MXN',
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by      UUID REFERENCES auth.users(id)
);

-- Fila única de configuración
INSERT INTO configuracion (iva_porcentaje, moneda) VALUES (16, 'MXN');

-- ─── PERFIL DE USUARIO ──────────────────────────────────────
-- Extiende auth.users de Supabase
CREATE TABLE usuarios (
  id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre  VARCHAR(255) NOT NULL,
  nivel   SMALLINT     NOT NULL DEFAULT 2
                       CHECK (nivel IN (0, 1, 2, 3)),
  -- nivel 0/1=Admin, 2=Estándar, 3=Restringido
  -- el rol 'contador' se maneja por email o campo extra
  es_contador BOOLEAN NOT NULL DEFAULT FALSE,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: crear perfil al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO usuarios (id, nombre, nivel)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email), 2);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── CLIENTES ───────────────────────────────────────────────
CREATE TABLE clientes (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(255) NOT NULL,
  rfc         VARCHAR(20),
  direccion   TEXT,
  telefono    VARCHAR(50),
  email       VARCHAR(255),
  contactos   JSONB        NOT NULL DEFAULT '[]',
  -- [{"nombre":"...", "telefono":"...", "email":"...", "puesto":"..."}]
  notas       TEXT,
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── INVENTARIO ─────────────────────────────────────────────
CREATE TABLE productos (
  id                          SERIAL PRIMARY KEY,
  codigo                      VARCHAR(100),
  nombre                      VARCHAR(255)   NOT NULL,
  descripcion                 TEXT,
  categoria                   VARCHAR(100),
  unidad                      VARCHAR(50)    NOT NULL DEFAULT 'pza',
  precio_venta                NUMERIC(12,2)  NOT NULL DEFAULT 0,
  precio_compra_neto          NUMERIC(12,2)  NOT NULL DEFAULT 0,
  precio_compra_incluye_iva   BOOLEAN        NOT NULL DEFAULT FALSE,
  iva_compra                  NUMERIC(5,2)   NOT NULL DEFAULT 16,
  -- precio_compra_con_iva es campo calculado, se guarda para facilitar reportes
  precio_compra_con_iva       NUMERIC(12,2)  GENERATED ALWAYS AS (
    CASE
      WHEN precio_compra_incluye_iva THEN precio_compra_neto
      ELSE ROUND(precio_compra_neto * (1 + iva_compra/100), 2)
    END
  ) STORED,
  stock                       NUMERIC(12,3)  NOT NULL DEFAULT 0,
  stock_minimo                NUMERIC(12,3)  NOT NULL DEFAULT 0,
  activo                      BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── COTIZACIONES ───────────────────────────────────────────
CREATE TABLE cotizaciones (
  id              SERIAL PRIMARY KEY,
  folio           VARCHAR(50)    NOT NULL UNIQUE,
  cliente_id      INT            NOT NULL REFERENCES clientes(id),
  fecha           DATE           NOT NULL DEFAULT CURRENT_DATE,
  vigencia        DATE,
  estado          VARCHAR(20)    NOT NULL DEFAULT 'borrador'
                                 CHECK (estado IN ('borrador','pendiente','enviada','aprobada','aceptada','rechazada','facturada','cancelada','pagada')),
  aplica_iva      BOOLEAN        NOT NULL DEFAULT FALSE,
  iva_porcentaje  NUMERIC(5,2)   NOT NULL DEFAULT 16,
  subtotal        NUMERIC(12,2)  NOT NULL DEFAULT 0,
  iva_monto       NUMERIC(12,2)  NOT NULL DEFAULT 0,
  total           NUMERIC(12,2)  NOT NULL DEFAULT 0,
  notas           TEXT,
  condiciones     TEXT,
  created_by      UUID           NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE cotizacion_items (
  id               SERIAL PRIMARY KEY,
  cotizacion_id    INT            NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  tipo             VARCHAR(30)    NOT NULL DEFAULT 'producto'
                                  CHECK (tipo IN ('producto','servicio','equipo_recuperado')),
  descripcion      TEXT           NOT NULL,
  cantidad         NUMERIC(12,3)  NOT NULL DEFAULT 1,
  precio_unitario  NUMERIC(12,2)  NOT NULL DEFAULT 0,
  descuento        NUMERIC(5,2)   NOT NULL DEFAULT 0,
  subtotal         NUMERIC(12,2)  NOT NULL DEFAULT 0,
  imagen_url       TEXT,
  -- imagen_url se copia del producto al crear/editar el ítem; como fallback el PDF busca via producto_id
  producto_id      INT            REFERENCES productos(id)
);

-- ─── REPORTES DE SERVICIO TÉCNICO ───────────────────────────
CREATE TABLE reportes (
  id                SERIAL PRIMARY KEY,
  folio             VARCHAR(50)   NOT NULL UNIQUE,
  cliente_id        INT           NOT NULL REFERENCES clientes(id),
  fecha_ingreso     DATE          NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega     DATE,
  equipo            VARCHAR(255)  NOT NULL,
  marca             VARCHAR(100),
  modelo            VARCHAR(100),
  serie             VARCHAR(100),
  falla_reportada   TEXT          NOT NULL,
  diagnostico       TEXT,
  trabajo_realizado TEXT,
  estado            VARCHAR(20)   NOT NULL DEFAULT 'abierto'
                                  CHECK (estado IN ('abierto','en_proceso','completado','entregado','cancelado')),
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  firma_cliente     TEXT,         -- URL en Supabase Storage o base64
  firma_fecha       TIMESTAMPTZ,
  tecnico_id        UUID          NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE reporte_items (
  id               SERIAL PRIMARY KEY,
  reporte_id       INT            NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
  descripcion      TEXT           NOT NULL,
  cantidad         NUMERIC(12,3)  NOT NULL DEFAULT 1,
  precio_unitario  NUMERIC(12,2)  NOT NULL DEFAULT 0,
  subtotal         NUMERIC(12,2)  NOT NULL DEFAULT 0
);

-- ─── AGENDA ─────────────────────────────────────────────────
CREATE TABLE eventos (
  id              SERIAL PRIMARY KEY,
  titulo          VARCHAR(255)  NOT NULL,
  descripcion     TEXT,
  tipo            VARCHAR(30)   NOT NULL DEFAULT 'otro'
                                CHECK (tipo IN ('visita','mantenimiento','instalacion','capacitacion','otro')),
  fecha_inicio    TIMESTAMPTZ   NOT NULL,
  fecha_fin       TIMESTAMPTZ,
  todo_el_dia     BOOLEAN       NOT NULL DEFAULT FALSE,
  cliente_id      INT           REFERENCES clientes(id),
  responsable_id  UUID          NOT NULL REFERENCES auth.users(id),
  color           VARCHAR(20)   DEFAULT '#3B82F6',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── VENTAS ─────────────────────────────────────────────────
CREATE TABLE ventas (
  id                SERIAL PRIMARY KEY,
  folio_referencia  VARCHAR(50)   NOT NULL,
  tipo              VARCHAR(20)   NOT NULL CHECK (tipo IN ('cotizacion','reporte')),
  cliente_id        INT           NOT NULL REFERENCES clientes(id),
  fecha             DATE          NOT NULL DEFAULT CURRENT_DATE,
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_monto         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  costo_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  ganancia          NUMERIC(12,2) GENERATED ALWAYS AS (total - costo_total) STORED,
  metodo_pago       VARCHAR(50),
  notas             TEXT,
  created_by        UUID          NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── GASTOS ─────────────────────────────────────────────────
CREATE TABLE gastos (
  id               SERIAL PRIMARY KEY,
  descripcion      VARCHAR(255)  NOT NULL,
  categoria        VARCHAR(100),
  tipo             VARCHAR(10)   NOT NULL DEFAULT 'variable'
                                 CHECK (tipo IN ('fijo','variable')),
  monto            NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha            DATE          NOT NULL DEFAULT CURRENT_DATE,
  recurrente       BOOLEAN       NOT NULL DEFAULT FALSE,
  periodo          VARCHAR(10)   CHECK (periodo IN ('mensual','anual')),
  comprobante_url  TEXT,
  created_by       UUID          NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── FUNCIONES UTILITARIAS ──────────────────────────────────

-- Auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cotizaciones_updated_at
  BEFORE UPDATE ON cotizaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_reportes_updated_at
  BEFORE UPDATE ON reportes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generador de folios
CREATE OR REPLACE FUNCTION generar_folio(prefijo TEXT, tabla TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  anio    TEXT := TO_CHAR(NOW(), 'YY');
  mes     TEXT := TO_CHAR(NOW(), 'MM');
  contador INT;
  folio   TEXT;
BEGIN
  EXECUTE format(
    'SELECT COUNT(*) FROM %I WHERE folio LIKE %L',
    tabla,
    prefijo || anio || mes || '%'
  ) INTO contador;

  folio := prefijo || anio || mes || LPAD((contador + 1)::TEXT, 4, '0');
  RETURN folio;
END;
$$;

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────

ALTER TABLE configuracion   ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos          ENABLE ROW LEVEL SECURITY;

-- Helper: obtener nivel del usuario actual
CREATE OR REPLACE FUNCTION mi_nivel()
RETURNS SMALLINT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT nivel FROM usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION soy_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT nivel <= 1 FROM usuarios WHERE id = auth.uid();
$$;

-- Configuración: solo admins pueden modificar
CREATE POLICY "config_select" ON configuracion FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_update" ON configuracion FOR UPDATE TO authenticated USING (soy_admin());

-- Usuarios: todos los autenticados pueden verse a sí mismos; admins ven todos
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT TO authenticated
  USING (id = auth.uid() OR soy_admin());
CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE TO authenticated
  USING (soy_admin());
CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT TO authenticated
  WITH CHECK (soy_admin());

-- Clientes: todos los autenticados leen; niveles 0-2 editan; solo admins borran
CREATE POLICY "clientes_select" ON clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "clientes_insert" ON clientes FOR INSERT TO authenticated
  WITH CHECK (mi_nivel() <= 2);
CREATE POLICY "clientes_update" ON clientes FOR UPDATE TO authenticated
  USING (mi_nivel() <= 2);
CREATE POLICY "clientes_delete" ON clientes FOR DELETE TO authenticated
  USING (soy_admin());

-- Productos
CREATE POLICY "productos_select" ON productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "productos_insert" ON productos FOR INSERT TO authenticated
  WITH CHECK (mi_nivel() <= 2);
CREATE POLICY "productos_update" ON productos FOR UPDATE TO authenticated
  USING (mi_nivel() <= 2);
CREATE POLICY "productos_delete" ON productos FOR DELETE TO authenticated
  USING (soy_admin());

-- Cotizaciones
CREATE POLICY "cotizaciones_select" ON cotizaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "cotizaciones_insert" ON cotizaciones FOR INSERT TO authenticated
  WITH CHECK (mi_nivel() <= 2);
CREATE POLICY "cotizaciones_update" ON cotizaciones FOR UPDATE TO authenticated
  USING (mi_nivel() <= 2);
CREATE POLICY "cotizaciones_delete" ON cotizaciones FOR DELETE TO authenticated
  USING (soy_admin());

CREATE POLICY "cotizacion_items_select" ON cotizacion_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "cotizacion_items_all" ON cotizacion_items FOR ALL TO authenticated
  USING (mi_nivel() <= 2) WITH CHECK (mi_nivel() <= 2);

-- Reportes
CREATE POLICY "reportes_select" ON reportes FOR SELECT TO authenticated USING (true);
CREATE POLICY "reportes_insert" ON reportes FOR INSERT TO authenticated
  WITH CHECK (mi_nivel() <= 2);
CREATE POLICY "reportes_update" ON reportes FOR UPDATE TO authenticated
  USING (mi_nivel() <= 2);
CREATE POLICY "reportes_delete" ON reportes FOR DELETE TO authenticated
  USING (soy_admin());

CREATE POLICY "reporte_items_select" ON reporte_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "reporte_items_all" ON reporte_items FOR ALL TO authenticated
  USING (mi_nivel() <= 2) WITH CHECK (mi_nivel() <= 2);

-- Eventos: todos leen; todos con nivel <= 2 editan
CREATE POLICY "eventos_select" ON eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "eventos_insert" ON eventos FOR INSERT TO authenticated
  WITH CHECK (mi_nivel() <= 2);
CREATE POLICY "eventos_update" ON eventos FOR UPDATE TO authenticated
  USING (mi_nivel() <= 2);
CREATE POLICY "eventos_delete" ON eventos FOR DELETE TO authenticated
  USING (soy_admin() OR responsable_id = auth.uid());

-- Ventas: nivel 3 NO puede ver
CREATE POLICY "ventas_select" ON ventas FOR SELECT TO authenticated
  USING (mi_nivel() < 3);
CREATE POLICY "ventas_insert" ON ventas FOR INSERT TO authenticated
  WITH CHECK (mi_nivel() <= 2);
CREATE POLICY "ventas_delete" ON ventas FOR DELETE TO authenticated
  USING (soy_admin());

-- Gastos: nivel 3 NO puede ver
CREATE POLICY "gastos_select" ON gastos FOR SELECT TO authenticated
  USING (mi_nivel() < 3);
CREATE POLICY "gastos_insert" ON gastos FOR INSERT TO authenticated
  WITH CHECK (mi_nivel() <= 2);
CREATE POLICY "gastos_update" ON gastos FOR UPDATE TO authenticated
  USING (mi_nivel() <= 2);
CREATE POLICY "gastos_delete" ON gastos FOR DELETE TO authenticated
  USING (soy_admin());

-- ─── STORAGE BUCKET ─────────────────────────────────────────
-- Ejecutar en: Supabase Dashboard → Storage → New Bucket
-- Nombre: "documentos" (privado)
-- O via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "documentos_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos');
CREATE POLICY "documentos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "documentos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND soy_admin());

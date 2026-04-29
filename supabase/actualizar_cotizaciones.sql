-- ─── Agregar columnas nuevas a cotizacion_items ──────────────────────────────
ALTER TABLE cotizacion_items
  ADD COLUMN IF NOT EXISTS precio_compra        NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_recuperada  NUMERIC(10,3) DEFAULT 0;

-- ─── Agregar columnas nuevas a cotizaciones ───────────────────────────────────
ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS ganancia_total           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quien_es_el_cliente      VARCHAR(100)  DEFAULT 'Didara',
  ADD COLUMN IF NOT EXISTS elaborado_por            TEXT,
  ADD COLUMN IF NOT EXISTS direccion_entrega        TEXT,
  ADD COLUMN IF NOT EXISTS contactos_cotizacion     JSONB         DEFAULT '[]';

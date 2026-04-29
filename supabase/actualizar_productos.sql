-- ─── Agregar columnas nuevas a la tabla productos ────────────────────────────

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS categorias         TEXT,
  ADD COLUMN IF NOT EXISTS clave_sat_producto VARCHAR(20),
  ADD COLUMN IF NOT EXISTS clave_sat_unidad   VARCHAR(10),
  ADD COLUMN IF NOT EXISTS imagen_url         TEXT;

-- ============================================================
-- Agregar campos del sistema original a la tabla reportes
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE reportes
  ADD COLUMN IF NOT EXISTS tipo_servicio       TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trabajos_realizados TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS observaciones       TEXT,
  ADD COLUMN IF NOT EXISTS direccion_servicio  TEXT,
  ADD COLUMN IF NOT EXISTS evidencias          JSONB   NOT NULL DEFAULT '[]';

-- Crear bucket para fotos de evidencia (ejecutar solo si no existe)
-- En el Dashboard de Supabase → Storage → New bucket
-- Nombre: evidencias, Public: true

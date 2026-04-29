-- ============================================================
-- Agregar campos de datos de empresa a la tabla configuracion
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE configuracion
  ADD COLUMN IF NOT EXISTS empresa_nombre    VARCHAR(255) NOT NULL DEFAULT 'DIDARA TI',
  ADD COLUMN IF NOT EXISTS empresa_direccion TEXT         NOT NULL DEFAULT 'Pipila 7, San Juan Ixhuatepec, 54180 Tlalnepantla, Méx.',
  ADD COLUMN IF NOT EXISTS empresa_telefono  VARCHAR(50)  NOT NULL DEFAULT '5566895603',
  ADD COLUMN IF NOT EXISTS empresa_email     VARCHAR(255) NOT NULL DEFAULT 'direccion@didara-ti.com',
  ADD COLUMN IF NOT EXISTS empresa_web       VARCHAR(255) NOT NULL DEFAULT 'www.didara-ti.com';

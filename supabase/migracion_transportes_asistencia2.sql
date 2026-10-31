-- ─── Transportes: falta automática por empleado y "día de descanso" ───
-- Correr en Supabase → SQL Editor. Se puede correr más de una vez.

-- Si está activo, un día en que la oficina trabajó y la persona no capturó talones ni informes
-- cuenta como falta (se puede cambiar a mano). A quién se le activa: Transportes → Asistencia → Empleados.
ALTER TABLE tcg_empleados ADD COLUMN IF NOT EXISTS sin_registro_es_falta BOOLEAN NOT NULL DEFAULT FALSE;

-- Marca a mano "descanso": día libre que da el patrón; no es falta ni baja el aguinaldo
ALTER TABLE tcg_asistencia DROP CONSTRAINT IF EXISTS tcg_asistencia_estado_check;
ALTER TABLE tcg_asistencia ADD CONSTRAINT tcg_asistencia_estado_check
  CHECK (estado IN ('asistio', 'falta', 'permiso', 'vacaciones', 'descanso'));

SELECT pg_notify('pgrst', 'reload schema');

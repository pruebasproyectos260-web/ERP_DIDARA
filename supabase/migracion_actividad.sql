-- ─── Registro de actividad (auditoría) ──────────────────────────
-- Correr una vez en Supabase → SQL Editor.
-- Guarda quién creó, editó o eliminó cada registro y cuándo.
-- Sin FK a usuarios a propósito: el historial se conserva aunque se borre el usuario.

CREATE TABLE IF NOT EXISTS actividad (
  id              BIGSERIAL    PRIMARY KEY,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  usuario_id      UUID,
  usuario_nombre  TEXT,
  accion          TEXT         NOT NULL,   -- crear | editar | eliminar | cambiar_estado | firmar | ...
  tabla           TEXT         NOT NULL,   -- cotizaciones, reportes, clientes, ...
  registro_id     TEXT,
  detalle         TEXT
);

CREATE INDEX IF NOT EXISTS actividad_created_at_idx ON actividad (created_at DESC);
CREATE INDEX IF NOT EXISTS actividad_registro_idx   ON actividad (tabla, registro_id);

-- Igual que el resto: sin políticas = la anon key no puede leer; el servidor usa service role
ALTER TABLE actividad ENABLE ROW LEVEL SECURITY;

SELECT pg_notify('pgrst', 'reload schema');

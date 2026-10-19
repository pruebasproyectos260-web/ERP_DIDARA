-- ─── Avisos push (notificaciones en celular y computadora) ───────
-- Correr una vez en Supabase → SQL Editor.
-- Cada persona activa los avisos en sus dispositivos desde la Mesa de ayuda;
-- aquí se guarda a dónde mandarle cada notificación.

CREATE TABLE IF NOT EXISTS push_suscripciones (
  id           BIGSERIAL    PRIMARY KEY,
  usuario_id   UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint     TEXT         NOT NULL UNIQUE,                  -- dirección del servicio push del navegador
  p256dh       TEXT         NOT NULL,
  auth         TEXT         NOT NULL,
  dispositivo  TEXT,                                          -- "Chrome en Android", "Safari en iPhone"…
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_suscripciones_usuario_idx ON push_suscripciones (usuario_id);

-- Claves del servidor para firmar los avisos (el ERP las genera solo la primera vez)
CREATE TABLE IF NOT EXISTS push_claves (
  id          INTEGER      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  publica     TEXT         NOT NULL,
  privada     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Sin políticas = la anon key no puede leer ni escribir; solo el servidor (service role)
ALTER TABLE push_suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_claves        ENABLE ROW LEVEL SECURITY;

SELECT pg_notify('pgrst', 'reload schema');

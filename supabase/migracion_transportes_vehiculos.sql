-- ─── Transportes: carros de la familia, documentos, kilometraje y aceite; fijos con periodo ───
-- Correr en Supabase → SQL Editor después de migracion_transportes.sql y migracion_transportes_fijos.sql.
-- Se puede correr más de una vez.

-- Gastos fijos que no son mensuales (cada 2, 3, 6, 12 meses…). "desde" es el mes del primer pago.
ALTER TABLE tcg_fijos ADD COLUMN IF NOT EXISTS cada_meses SMALLINT NOT NULL DEFAULT 1 CHECK (cada_meses BETWEEN 1 AND 24);

-- Vehículos: camiones de la empresa y carros de la familia (misma tabla)
ALTER TABLE tcg_camiones ADD COLUMN IF NOT EXISTS uso TEXT NOT NULL DEFAULT 'empresa' CHECK (uso IN ('empresa', 'familia'));
-- Cambio de aceite: por km o por meses, lo que pase primero; "último" es el punto de partida si se hizo antes de usar el sistema
ALTER TABLE tcg_camiones ADD COLUMN IF NOT EXISTS aceite_cada_km      INTEGER  CHECK (aceite_cada_km > 0);
ALTER TABLE tcg_camiones ADD COLUMN IF NOT EXISTS aceite_cada_meses   SMALLINT CHECK (aceite_cada_meses BETWEEN 1 AND 24);
ALTER TABLE tcg_camiones ADD COLUMN IF NOT EXISTS aceite_ultimo_km    INTEGER  CHECK (aceite_ultimo_km >= 0);
ALTER TABLE tcg_camiones ADD COLUMN IF NOT EXISTS aceite_ultima_fecha DATE;

-- Un trabajo puede ser el cambio de aceite (reinicia la cuenta)
ALTER TABLE tcg_trabajos ADD COLUMN IF NOT EXISTS cambio_aceite BOOLEAN NOT NULL DEFAULT FALSE;

-- Lecturas del odómetro
CREATE TABLE IF NOT EXISTS tcg_kilometraje (
  id          BIGSERIAL    PRIMARY KEY,
  camion_id   BIGINT       NOT NULL REFERENCES tcg_camiones(id) ON DELETE CASCADE,
  fecha       DATE         NOT NULL,
  km          INTEGER      NOT NULL CHECK (km >= 0),
  nota        TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tcg_kilometraje_camion_idx ON tcg_kilometraje (camion_id, fecha DESC);

-- Documentos de cada vehículo (seguro, verificaciones, tarjeta de circulación…) con su vencimiento y archivos
CREATE TABLE IF NOT EXISTS tcg_documentos (
  id          BIGSERIAL    PRIMARY KEY,
  camion_id   BIGINT       NOT NULL REFERENCES tcg_camiones(id) ON DELETE CASCADE,
  tipo        TEXT         NOT NULL,
  nombre      TEXT         NOT NULL,
  vence       DATE,                                          -- cuándo vence o cuándo toca (null = no vence)
  cada_meses  SMALLINT     CHECK (cada_meses BETWEEN 1 AND 60), -- cada cuánto se renueva (para sugerir la siguiente fecha)
  archivos    TEXT[]       NOT NULL DEFAULT '{}',            -- PDF/fotos en Storage (bucket documentos, carpeta tcg/)
  notas       TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tcg_documentos_camion_idx ON tcg_documentos (camion_id);

ALTER TABLE tcg_kilometraje ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcg_documentos  ENABLE ROW LEVEL SECURITY;

SELECT pg_notify('pgrst', 'reload schema');

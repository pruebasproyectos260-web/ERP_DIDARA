-- ─── Transportes: gastos fijos (renta, luz, internet, sueldos, colegiaturas…) ───
-- Correr en Supabase → SQL Editor después de migracion_transportes.sql. Se puede correr más de una vez.

-- Lo que se paga cada mes, de la empresa o de la casa
CREATE TABLE IF NOT EXISTS tcg_fijos (
  id           BIGSERIAL      PRIMARY KEY,
  ambito       TEXT           NOT NULL CHECK (ambito IN ('empresa', 'hogar')),
  nombre       TEXT           NOT NULL,
  categoria    TEXT           NOT NULL,
  monto        NUMERIC(12,2)  NOT NULL CHECK (monto > 0),
  dia          SMALLINT       CHECK (dia BETWEEN 1 AND 31),    -- día del mes en que vence
  desde        TEXT           NOT NULL,                        -- 'YYYY-MM' primer mes
  hasta        TEXT,                                           -- 'YYYY-MM' último mes (null = vigente)
  metodo_pago  TEXT,
  con_factura  BOOLEAN        NOT NULL DEFAULT FALSE,
  camion_id    BIGINT         REFERENCES tcg_camiones(id) ON DELETE SET NULL,
  notas        TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Al marcarlo como pagado se crea su gasto del mes (uno solo por mes)
ALTER TABLE tcg_gastos ADD COLUMN IF NOT EXISTS fijo_id  BIGINT REFERENCES tcg_fijos(id) ON DELETE SET NULL;
ALTER TABLE tcg_gastos ADD COLUMN IF NOT EXISTS mes_fijo TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS tcg_gastos_fijo_mes_idx ON tcg_gastos (fijo_id, mes_fijo) WHERE fijo_id IS NOT NULL;

ALTER TABLE tcg_fijos ENABLE ROW LEVEL SECURITY;

SELECT pg_notify('pgrst', 'reload schema');

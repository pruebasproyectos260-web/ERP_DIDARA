-- ─── Finanzas: movimientos (gastos e ingresos), pagos y cobros fijos ─────────
-- Correr en Supabase → SQL Editor.
-- No borra ni modifica las tablas anteriores (gastos_variables, gastos_fijos,
-- ganancias_fijas, ingresos_manuales): solo COPIA sus datos al módulo nuevo.
-- Se puede correr más de una vez sin duplicar nada (columna "origen").

-- Pagos y cobros que se repiten cada mes (renta, internet, sueldos, pólizas de clientes…)
CREATE TABLE IF NOT EXISTS fin_recurrentes (
  id           BIGSERIAL      PRIMARY KEY,
  tipo         TEXT           NOT NULL CHECK (tipo IN ('gasto', 'ingreso')),
  nombre       TEXT           NOT NULL,
  categoria    TEXT           NOT NULL,
  monto        NUMERIC(12,2)  NOT NULL CHECK (monto >= 0),
  dia          SMALLINT       CHECK (dia BETWEEN 1 AND 31),     -- día del mes en que vence
  desde        TEXT           NOT NULL,                         -- 'YYYY-MM' primer mes
  hasta        TEXT,                                            -- 'YYYY-MM' último mes (null = vigente)
  cliente_id   INTEGER        REFERENCES clientes(id) ON DELETE SET NULL,
  metodo_pago  TEXT,
  con_factura  BOOLEAN        NOT NULL DEFAULT FALSE,
  notas        TEXT,
  origen       TEXT           UNIQUE,                           -- p. ej. 'gastos_fijos:5'
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Cada peso que entra o sale
CREATE TABLE IF NOT EXISTS movimientos (
  id                 BIGSERIAL      PRIMARY KEY,
  tipo               TEXT           NOT NULL CHECK (tipo IN ('gasto', 'ingreso')),
  fecha              DATE           NOT NULL,
  categoria          TEXT           NOT NULL,
  descripcion        TEXT,
  proveedor          TEXT,                                        -- dónde se compró / quién pagó
  monto              NUMERIC(12,2)  NOT NULL CHECK (monto > 0),   -- total, IVA incluido
  metodo_pago        TEXT,
  con_factura        BOOLEAN        NOT NULL DEFAULT FALSE,
  iva                NUMERIC(12,2)  CHECK (iva >= 0),
  comprobantes       TEXT[]         NOT NULL DEFAULT '{}',        -- fotos/PDF en Storage (bucket documentos)
  cliente_id         INTEGER        REFERENCES clientes(id) ON DELETE SET NULL,
  cotizacion_id      INTEGER        REFERENCES cotizaciones(id) ON DELETE SET NULL,
  reporte_id         INTEGER        REFERENCES reportes(id) ON DELETE SET NULL,
  recurrente_id      BIGINT         REFERENCES fin_recurrentes(id) ON DELETE SET NULL,
  mes_recurrente     TEXT,                                        -- 'YYYY-MM' del pago/cobro fijo
  registrado_por     UUID,                                        -- sin FK: el registro se conserva aunque se borre la cuenta
  registrado_nombre  TEXT,
  revisado           BOOLEAN        NOT NULL DEFAULT FALSE,
  revisado_por       TEXT,
  revisado_at        TIMESTAMPTZ,
  importado          BOOLEAN        NOT NULL DEFAULT FALSE,       -- vino del sistema anterior
  origen             TEXT           UNIQUE,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS movimientos_fecha_idx       ON movimientos (fecha DESC);
CREATE INDEX IF NOT EXISTS movimientos_registrado_idx  ON movimientos (registrado_por);
CREATE INDEX IF NOT EXISTS movimientos_cotizacion_idx  ON movimientos (cotizacion_id) WHERE cotizacion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS movimientos_reporte_idx     ON movimientos (reporte_id)    WHERE reporte_id IS NOT NULL;
-- Un pago fijo solo se marca una vez por mes
CREATE UNIQUE INDEX IF NOT EXISTS movimientos_recurrente_mes_idx
  ON movimientos (recurrente_id, mes_recurrente) WHERE recurrente_id IS NOT NULL;

-- Igual que el resto: sin políticas = la anon key no puede leer; el servidor usa service role
ALTER TABLE fin_recurrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos     ENABLE ROW LEVEL SECURITY;


-- ─── Copia de los datos actuales ─────────────────────────────────

-- Gastos variables → movimientos (ya revisados: los capturó la administración)
INSERT INTO movimientos (tipo, fecha, categoria, descripcion, monto, metodo_pago,
                         registrado_nombre, revisado, importado, origen, created_at)
SELECT 'gasto', fecha, COALESCE(NULLIF(TRIM(tipo), ''), 'Otro'), descripcion, monto, metodo_pago,
       registrado_por, TRUE, TRUE, 'gastos_variables:' || id, created_at
FROM gastos_variables
WHERE monto > 0 AND fecha IS NOT NULL
ON CONFLICT (origen) DO NOTHING;

-- Ingresos manuales → movimientos
INSERT INTO movimientos (tipo, fecha, categoria, descripcion, monto, revisado, importado, origen, created_at)
SELECT 'ingreso', fecha, 'Otro ingreso',
       CONCAT_WS(' — ', NULLIF(descripcion, ''), NULLIF(notas, '')), monto, TRUE, TRUE,
       'ingresos_manuales:' || id, created_at
FROM ingresos_manuales
WHERE monto > 0 AND fecha IS NOT NULL
ON CONFLICT (origen) DO NOTHING;

-- Cotizaciones ya pagadas → ingresos (con la fecha de la cotización, como las mostraba Ventas)
INSERT INTO movimientos (tipo, fecha, categoria, descripcion, monto, con_factura, iva,
                         cliente_id, cotizacion_id, revisado, importado, origen, created_at)
SELECT 'ingreso', fecha, 'Cotización', 'Cotización ' || folio, total,
       COALESCE(aplica_iva, FALSE), CASE WHEN aplica_iva THEN iva_monto END,
       cliente_id, id, TRUE, TRUE, 'cotizacion:' || id, NOW()
FROM cotizaciones
WHERE estado = 'pagada' AND total > 0 AND fecha IS NOT NULL
ON CONFLICT (origen) DO NOTHING;

-- Reportes completados/entregados SIN firma → se dan por cobrados (regla acordada: antes de
-- la firma en línea, "completado" significaba que ya se cobró). Los firmados se cobran en Cobranza.
INSERT INTO movimientos (tipo, fecha, categoria, descripcion, monto, cliente_id, reporte_id,
                         revisado, importado, origen, created_at)
SELECT 'ingreso', COALESCE(fecha_entrega, fecha_ingreso), 'Servicio', 'Reporte ' || folio, total,
       cliente_id, id, TRUE, TRUE, 'reporte:' || id, NOW()
FROM reportes
WHERE estado IN ('completado', 'entregado') AND firma_fecha IS NULL AND total > 0
  AND COALESCE(fecha_entrega, fecha_ingreso) IS NOT NULL
ON CONFLICT (origen) DO NOTHING;

-- Gastos fijos → pagos fijos del mes
INSERT INTO fin_recurrentes (tipo, nombre, categoria, monto, dia, desde, notas, origen, created_at)
SELECT 'gasto', nombre,
       CASE
         WHEN nombre ILIKE '%renta%'                                        THEN 'Renta'
         WHEN nombre ILIKE '%sueldo%' OR nombre ILIKE '%nómina%' OR nombre ILIKE '%nomina%' THEN 'Sueldos'
         WHEN nombre ILIKE '%préstamo%' OR nombre ILIKE '%prestamo%' OR nombre ILIKE '%crédito%' OR nombre ILIKE '%credito%' THEN 'Préstamos'
         WHEN nombre ILIKE '%internet%' OR nombre ILIKE '%luz%' OR nombre ILIKE '%agua%'
           OR nombre ILIKE '%teléfono%' OR nombre ILIKE '%telefono%' OR nombre ILIKE '%telmex%' THEN 'Servicios'
         ELSE 'Otro'
       END,
       monto, CASE WHEN dia BETWEEN 1 AND 31 THEN dia END,
       COALESCE(NULLIF(fecha_inicio, ''), TO_CHAR(created_at, 'YYYY-MM')), notas,
       'gastos_fijos:' || id, created_at
FROM gastos_fijos
ON CONFLICT (origen) DO NOTHING;

-- Ganancias fijas (pólizas de clientes) → cobros fijos del mes
INSERT INTO fin_recurrentes (tipo, nombre, categoria, monto, dia, desde, notas, origen, created_at)
SELECT 'ingreso', descripcion, 'Póliza', monto, CASE WHEN dia BETWEEN 1 AND 31 THEN dia END,
       COALESCE(NULLIF(fecha_inicio, ''), TO_CHAR(created_at, 'YYYY-MM')), notas,
       'ganancias_fijas:' || id, created_at
FROM ganancias_fijas
ON CONFLICT (origen) DO NOTHING;

SELECT pg_notify('pgrst', 'reload schema');


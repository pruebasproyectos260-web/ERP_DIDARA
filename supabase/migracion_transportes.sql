-- ─── Transportes de Carga General Vicente Guerrero (solo super admin, nivel 0) ───
-- Correr en Supabase → SQL Editor. Se puede correr más de una vez sin duplicar nada.
-- Tablas con prefijo tcg_. Sin políticas RLS: solo el servidor (service role) las lee,
-- y las rutas /api/transportes/* exigen nivel 0.

-- Camiones de la flota
CREATE TABLE IF NOT EXISTS tcg_camiones (
  id          BIGSERIAL    PRIMARY KEY,
  nombre      TEXT         NOT NULL,                 -- número económico o como se le conoce
  placas      TEXT,
  marca       TEXT,
  modelo      TEXT,
  anio        SMALLINT     CHECK (anio BETWEEN 1950 AND 2100),
  notas       TEXT,
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Gastos de la empresa y de la casa
CREATE TABLE IF NOT EXISTS tcg_gastos (
  id            BIGSERIAL      PRIMARY KEY,
  ambito        TEXT           NOT NULL CHECK (ambito IN ('empresa', 'hogar')),
  fecha         DATE           NOT NULL,
  categoria     TEXT           NOT NULL,
  descripcion   TEXT,
  proveedor     TEXT,
  monto         NUMERIC(12,2)  NOT NULL CHECK (monto > 0),   -- lo que se pagó, IVA incluido
  metodo_pago   TEXT,
  con_factura   BOOLEAN        NOT NULL DEFAULT FALSE,
  iva           NUMERIC(12,2)  CHECK (iva >= 0),
  comprobantes  TEXT[]         NOT NULL DEFAULT '{}',        -- fotos/PDF en Storage (bucket documentos, carpeta tcg/)
  camion_id     BIGINT         REFERENCES tcg_camiones(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tcg_gastos_fecha_idx ON tcg_gastos (ambito, fecha DESC);

-- Trabajos hechos a cada camión; si costaron, generan su gasto de la empresa
CREATE TABLE IF NOT EXISTS tcg_trabajos (
  id           BIGSERIAL      PRIMARY KEY,
  camion_id    BIGINT         NOT NULL REFERENCES tcg_camiones(id) ON DELETE RESTRICT,
  fecha        DATE           NOT NULL,
  tipo         TEXT           NOT NULL CHECK (tipo IN ('mecanico', 'electrico', 'carroceria', 'neumaticos', 'otro')),
  descripcion  TEXT           NOT NULL,
  taller       TEXT,
  kilometraje  INTEGER        CHECK (kilometraje >= 0),
  costo        NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (costo >= 0),
  gasto_id     BIGINT         UNIQUE REFERENCES tcg_gastos(id) ON DELETE SET NULL,
  notas        TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tcg_trabajos_camion_idx ON tcg_trabajos (camion_id, fecha DESC);

-- Empleados (sueldo semanal para el aguinaldo)
CREATE TABLE IF NOT EXISTS tcg_empleados (
  id               BIGSERIAL      PRIMARY KEY,
  nombre           TEXT           NOT NULL,
  usuario_sistema  TEXT,                                   -- como aparece en TALONES/REMI (p. ej. LUPE); vacío = exento
  sueldo_semanal   NUMERIC(12,2)  NOT NULL DEFAULT 2250 CHECK (sueldo_semanal >= 0),
  fecha_ingreso    DATE,                                   -- vacío = desde antes del año en curso
  fecha_baja       DATE,
  activo           BOOLEAN        NOT NULL DEFAULT TRUE,
  notas            TEXT,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Lo que cada usuario hizo por día en TALONES/REMI (lo manda la Raspberry cada noche)
CREATE TABLE IF NOT EXISTS tcg_actividad (
  fecha           DATE         NOT NULL,
  usuario         TEXT         NOT NULL,
  documentos      INTEGER      NOT NULL DEFAULT 0,
  fuentes         TEXT[]       NOT NULL DEFAULT '{}',      -- talones, remisiones, relaciones, caja
  actualizado_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fecha, usuario)
);

-- Movimiento total de la oficina por día (todos los usuarios). Sin movimiento = probablemente no se
-- trabajó (feriado); muy poco = por revisar. "estado" lo pone el usuario y manda sobre lo automático.
CREATE TABLE IF NOT EXISTS tcg_dias (
  fecha           DATE         PRIMARY KEY,
  documentos      INTEGER      CHECK (documentos >= 0),       -- null = aún no se lee de TALONES/REMI
  estado          TEXT         CHECK (estado IN ('laborable', 'cerrado')),
  nota            TEXT,
  actualizado_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Marcas a mano (faltas, vacaciones…); mandan sobre lo automático
CREATE TABLE IF NOT EXISTS tcg_asistencia (
  empleado_id  BIGINT       NOT NULL REFERENCES tcg_empleados(id) ON DELETE CASCADE,
  fecha        DATE         NOT NULL,
  estado       TEXT         NOT NULL CHECK (estado IN ('asistio', 'falta', 'permiso', 'vacaciones')),
  nota         TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (empleado_id, fecha)
);

ALTER TABLE tcg_camiones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcg_gastos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcg_trabajos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcg_empleados  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcg_actividad  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcg_dias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcg_asistencia ENABLE ROW LEVEL SECURITY;

-- Los empleados se agregan desde Transportes → Asistencia → Empleados
-- (los nombres no van aquí: el repositorio es público).

SELECT pg_notify('pgrst', 'reload schema');

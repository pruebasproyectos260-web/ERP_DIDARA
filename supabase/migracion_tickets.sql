-- ─── Mesa de ayuda (tickets de soporte) ─────────────────────────
-- Correr una vez en Supabase → SQL Editor.
-- Los clientes levantan tickets desde su enlace del portal (/soporte) y el equipo
-- también los registra cuando llegan por WhatsApp, llamada o correo.

CREATE TABLE IF NOT EXISTS tickets (
  id                 BIGSERIAL    PRIMARY KEY,
  folio              TEXT         NOT NULL UNIQUE,                 -- TKT-0001
  cliente_id         INTEGER      REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nombre     TEXT,                                          -- por si no es cliente registrado
  contacto_nombre    TEXT,
  contacto_email     TEXT,
  contacto_telefono  TEXT,
  asunto             TEXT         NOT NULL,
  descripcion        TEXT         NOT NULL,
  categoria          TEXT         NOT NULL DEFAULT 'soporte',
  prioridad          TEXT         NOT NULL DEFAULT 'media'
                     CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
  estado             TEXT         NOT NULL DEFAULT 'abierto'
                     CHECK (estado IN ('abierto', 'en_proceso', 'en_espera', 'resuelto', 'cerrado')),
  origen             TEXT         NOT NULL DEFAULT 'interno'
                     CHECK (origen IN ('portal', 'whatsapp', 'telefono', 'correo', 'interno')),
  asignado_a         UUID,                                          -- usuario que lo atiende
  reporte_id         INTEGER      REFERENCES reportes(id) ON DELETE SET NULL,
  creado_por         UUID,
  resuelto_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_estado_idx     ON tickets (estado);
CREATE INDEX IF NOT EXISTS tickets_cliente_idx    ON tickets (cliente_id);
CREATE INDEX IF NOT EXISTS tickets_created_at_idx ON tickets (created_at DESC);

-- Seguimiento del ticket: comentarios del equipo, del cliente y cambios de estado
CREATE TABLE IF NOT EXISTS ticket_comentarios (
  id               BIGSERIAL    PRIMARY KEY,
  ticket_id        BIGINT       NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  autor_id         UUID,                                            -- null = cliente o sistema
  autor_nombre     TEXT         NOT NULL,
  mensaje          TEXT         NOT NULL,
  visible_cliente  BOOLEAN      NOT NULL DEFAULT TRUE,              -- false = nota interna
  es_sistema       BOOLEAN      NOT NULL DEFAULT FALSE,             -- cambios de estado automáticos
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_comentarios_ticket_idx ON ticket_comentarios (ticket_id, created_at);

-- Igual que el resto: sin políticas = la anon key no puede leer; el servidor usa service role
ALTER TABLE tickets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comentarios ENABLE ROW LEVEL SECURITY;

SELECT pg_notify('pgrst', 'reload schema');

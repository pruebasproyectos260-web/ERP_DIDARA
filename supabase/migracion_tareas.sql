-- ─── Tareas programadas del ERP ──────────────────────────────────
-- Correr en Supabase → SQL Editor (requiere pg_cron y pg_net, ya activados en despertar_render.sql).
-- Cada 15 minutos Supabase visita /api/cron, que:
--   · manda a los encargados de la Agenda el resumen del día (desde las 5 am)
--     y un recordatorio 2 horas antes de cada evento;
--   · el día 1 desde las 8 am envía a contabilidad el Excel del mes anterior.
-- "avisos_enviados" guarda qué aviso ya salió, para que nunca se repita.
--
-- CLAVE_DE_TAREAS: la clave del enlace (se la da Claude/el desarrollador; no se guarda en el repositorio).

CREATE TABLE IF NOT EXISTS avisos_enviados (
  clave       TEXT         PRIMARY KEY,   -- p. ej. 'agenda-2h:15:2026-10-21T10:00', 'contabilidad:2026-10'
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE avisos_enviados ENABLE ROW LEVEL SECURITY;

SELECT cron.schedule(
  'tareas-erp',
  '*/15 * * * *',
  $$ SELECT net.http_get(url := 'https://erp.didara-ti.com/api/cron?t=CLAVE_DE_TAREAS', timeout_milliseconds := 60000) $$
);

SELECT pg_notify('pgrst', 'reload schema');

-- Para revisar:   SELECT jobname, schedule, active FROM cron.job;
-- Para quitarlo:  SELECT cron.unschedule('tareas-erp');

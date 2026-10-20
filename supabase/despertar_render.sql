-- ─── Mantener despierto el ERP en Render ─────────────────────────
-- Correr una vez en Supabase → SQL Editor.
-- El plan gratuito de Render apaga el servidor tras 15 min sin visitas y la siguiente
-- carga tarda 30-60 s. Supabase visita la página de login cada 10 min (16 KB, ~0.3 s)
-- para que no se duerma; si ya estaba dormido, la visita lo despierta.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Cada 10 minutos (si se vuelve a correr, solo actualiza la tarea)
SELECT cron.schedule(
  'despertar-erp',
  '*/10 * * * *',
  $$ SELECT net.http_get(url := 'https://erp.didara-ti.com/login', timeout_milliseconds := 60000) $$
);

-- Domingos 4 am (UTC): borra el historial de ejecuciones de más de 7 días para que no crezca
SELECT cron.schedule(
  'limpiar-historial-cron',
  '0 4 * * 0',
  $$ DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '7 days' $$
);

-- Para revisar que esté corriendo:
--   SELECT jobname, schedule, active FROM cron.job;
-- Para quitarlo algún día:
--   SELECT cron.unschedule('despertar-erp');

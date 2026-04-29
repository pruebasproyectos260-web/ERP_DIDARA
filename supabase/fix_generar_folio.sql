-- ============================================================
-- Corregir generar_folio: formato secuencial PREFIX-XXXX
-- (en vez del formato basado en fecha PREFIX{YY}{MM}{XXXX})
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION generar_folio(prefijo TEXT, tabla TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  max_num    INT  := 0;
  last_folio TEXT;
  folio      TEXT;
BEGIN
  -- Buscar el folio más alto del formato PREFIX-NNNN
  EXECUTE format(
    'SELECT folio FROM %I WHERE folio LIKE %L ORDER BY LENGTH(folio) DESC, folio DESC LIMIT 1',
    tabla,
    prefijo || '-%'
  ) INTO last_folio;

  IF last_folio IS NOT NULL THEN
    BEGIN
      max_num := CAST(SPLIT_PART(last_folio, '-', 2) AS INT);
    EXCEPTION WHEN OTHERS THEN
      max_num := 0;
    END;
  END IF;

  folio := prefijo || '-' || LPAD((max_num + 1)::TEXT, 4, '0');
  RETURN folio;
END;
$$;

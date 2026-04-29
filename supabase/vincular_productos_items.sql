-- ============================================================
-- Vincular producto_id en cotizacion_items por descripción
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Idempotente: seguro de re-ejecutar, no sobreescribe ya vinculados
-- ============================================================

-- ─── PASO 1: Agregar columna imagen_url (si no existe) ──────
ALTER TABLE cotizacion_items ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- ─── PASO 2: Match exacto por descripcion O nombre ──────────
-- Cubre los productos donde descripcion = NULL (usa nombre del producto)
-- Ejemplos: PROD-0169 "Disco Duro PURPLE de 6TB",
--           PROD-0171 "Kit Teclado Estándar y Mouse ACTECK",
--           PROD-0172 "Disco Solido 240 Gb Wester Digital", etc.
UPDATE cotizacion_items ci
SET
  producto_id = p.id,
  imagen_url  = p.imagen_url
FROM productos p
WHERE ci.tipo = 'producto'
  AND ci.producto_id IS NULL
  AND LOWER(TRIM(ci.descripcion)) = LOWER(TRIM(COALESCE(p.descripcion, p.nombre)));

-- ─── PASO 3: Updates específicos (descripción difiere levemente) ─

-- Fuente PREMIUM (descripcion en BD tiene doble espacio antes de "EPCOM")
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0020'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'fuente premium 11-15 v 18 canales%';

-- UPS (ítem tiene " CDP Li-504" al final, producto no lo tiene)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0039'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'ups 4 salidas / 500va/250w%';

-- Bobina de cable UTP (espaciado diferente alrededor de slashes)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0026'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'bobina de cable utp%305 metros%';

-- Fuente de Poder Dahua (descripcion en BD tiene "/" y doble espacio)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0025'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'fuente de poder de 12 vcc 1 amper fcc dahua%';

-- KIT TurboHD HiLook (wording ligeramente distinto: ":" vs "incluye:", falta "con")
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0013'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'kit turbohd 1080p hilook%dvr 8 canales%';

-- Cámara IP Domo 4MP Hikvision (BD tiene "/" sin espacios, ítem usa " / ")
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0190'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'camara ip domo de 4 megapixeles%lente de 2.8mm%';

-- Switch PoE 6 puertos (descripcion varía en "Watts" vs "W", uplinks, etc.)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0191'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'switch poe de 6 puertos fast ethernet%';

-- Lámpara Led Solar (BD tiene typo "Públic" en lugar de "Público")
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0195'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE '%lámpara led solar exterior suburbana%';

-- Access Point UniFi WiFi 7 Pro (BD añade "(2.4/5/6 GHz)" en medio)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0177'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'access point unifi wifi 7 pro%';

-- Checador wifi MinMoe (descripcion en BD es solo "Checador wifi")
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0209'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'checador wifi minmoe%';

-- ESET Small Office Security (ítem tiene "10 licencias" al final)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0140'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'eset small office security%';

-- Kit Videoportero IP (BD añade "+ Carcasa protectora" en la descripcion)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0205'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'kit videoportero ip 2 megapixel%';

-- Monitor Híbrido IP (BD añade "Estándar" y "/ Policarbonato" extra)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0206'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'monitor hibrido ip wifi touch screen 7%';

-- Teléfono IP (descripcion en BD usa comas en lugar de " / ")
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0210'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'teléfono ip grado operador%';

-- Cámara 4MP Domo Hikvision HiLook (BD tiene "4MPDomo" sin espacio)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0219'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'camara 4mp domo hikvision%';

-- Gabinete metálico 30x30x15 (BD usa "30.0 cm" en lugar de "30 cm")
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0147'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'gabinete metálico 30 cm x 30 cm x 15 cm%';

-- Smart TV 50" (BD tiene "4k" minúsculas, ítem tiene "4K" mayúsculas)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0214'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'smart tv 50%4k%';

-- Soporte de TV Movible (descripcion en BD está truncada sin medidas)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0215'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'soporte de tv movible%';

-- Cámara Bala IP 4 mp Hikvision HiLook (descripcion en BD no tiene "HiLook")
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0218'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE 'camara bala ip 4 mp hikvision hilook%';

-- [Dual Light] HiLook Domo IP 4 Megapixel (ítem tiene descripcion abreviada)
UPDATE cotizacion_items ci SET producto_id = p.id, imagen_url = p.imagen_url
FROM productos p WHERE p.codigo = 'PROD-0184'
  AND ci.tipo = 'producto' AND ci.producto_id IS NULL
  AND LOWER(ci.descripcion) LIKE '[dual light] hilook domo ip 4 megapixel%';

-- ─── RESULTADO: Cuántos ítems quedaron vinculados ────────────
SELECT
  COUNT(*) FILTER (WHERE producto_id IS NOT NULL)        AS vinculados,
  COUNT(*) FILTER (WHERE producto_id IS NULL AND tipo = 'producto') AS sin_vincular,
  COUNT(*) FILTER (WHERE tipo = 'servicio')              AS servicios
FROM cotizacion_items;

-- ─── Ver los que aún no pudieron vincularse ──────────────────
SELECT ci.cotizacion_id, c.folio, ci.descripcion
FROM cotizacion_items ci
JOIN cotizaciones c ON c.id = ci.cotizacion_id
WHERE ci.tipo = 'producto' AND ci.producto_id IS NULL
ORDER BY ci.cotizacion_id;

-- ============================================================
-- Importar reportes históricos del sistema original
-- Folios: RST-0057 → RST-0078 (falta RST-0076)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Limpiar si ya existen (reejecutar sin duplicados) ────────
DELETE FROM reporte_items
WHERE reporte_id IN (
  SELECT id FROM reportes
  WHERE folio IN (
    'RST-0057','RST-0058','RST-0059','RST-0060','RST-0061',
    'RST-0062','RST-0063','RST-0064','RST-0065','RST-0066',
    'RST-0067','RST-0068','RST-0069','RST-0070','RST-0071',
    'RST-0072','RST-0073','RST-0074','RST-0075','RST-0077','RST-0078'
  )
);
DELETE FROM reportes
WHERE folio IN (
  'RST-0057','RST-0058','RST-0059','RST-0060','RST-0061',
  'RST-0062','RST-0063','RST-0064','RST-0065','RST-0066',
  'RST-0067','RST-0068','RST-0069','RST-0070','RST-0071',
  'RST-0072','RST-0073','RST-0074','RST-0075','RST-0077','RST-0078'
);

-- ── RST-0057 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0057', '2026-03-03',
  (SELECT id FROM clientes WHERE nombre ILIKE '%prueba%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Aldrich%' LIMIT 1),
  'Servicio técnico',
  'Locura esquina con esquizofrenia, Col. Demencia, codigo postal 08800. Ciudad trastornos mentales',
  ARRAY['Mantenimiento Correctivo','Soporte Técnico','Reparación'],
  'Seccion de reportes no funcionaba bien',
  'fallo de logica',
  ARRAY['probando','verificando'],
  '[{"tipo":"antes","descripcion":"antes","urls":["https://drive.google.com/file/d/1SbdknSs3USQj8DfwkCIfAJ8OL61qr5je/view?usp=drivesdk","https://drive.google.com/file/d/1bNxy4_VJac8euRvQaohhkQi8dSk7QDU2/view?usp=drivesdk","https://drive.google.com/file/d/1CaM4LeYblfXM1fQHa6EtahEDLvLOoON6/view?usp=drivesdk"]},{"tipo":"despues","descripcion":"despues","urls":["https://drive.google.com/file/d/1GxPcpVaqpIUDddtQQcQxXH7OQcg8EHW3/view?usp=drivesdk","https://drive.google.com/file/d/13U7rmOuMbBxZ2FzFZ51LQD0iKneH7jD8/view?usp=drivesdk","https://drive.google.com/file/d/1ciR1rA50WtiRSKlmuTWAzEFodlXGym3z/view?usp=drivesdk"]}]'::jsonb,
  4800, 4800, 'en_proceso', 'observando claro';

INSERT INTO reporte_items (reporte_id, descripcion, cantidad, precio_unitario, subtotal)
SELECT r.id, 'conectores', 4, 5.00, 20.00 FROM reportes r WHERE r.folio = 'RST-0057'
UNION ALL
SELECT r.id, 'camara',     1, 1000.00, 1000.00 FROM reportes r WHERE r.folio = 'RST-0057';

-- ── RST-0058 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0058', '2026-03-06',
  (SELECT id FROM clientes WHERE nombre ILIKE '%GRUPO CAL%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Edwin%' LIMIT 1),
  'Servicio técnico',
  'Vasco de Quiroga 1249, Santa Fe, Álvaro Obregón, 01260 Ciudad de México, CDMX',
  ARRAY['Soporte Técnico'],
  'Apoyo en la migracion de datos de correos',
  NULL,
  ARRAY[E'Sincronizacion de archivo pst con el correo en microsoft exchange\nSe realizo la sincronizacion de archivos de Mariana, Imelda, Alejandro y un vendedor, además, de la revisión de los archivos del correo de Nancy y Viri que se sincronizo de manera remota el dia Jueves.'],
  '[]'::jsonb,
  0, 0, 'en_proceso', NULL;

-- ── RST-0059 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0059', '2026-03-08',
  (SELECT id FROM clientes WHERE nombre ILIKE '%AZULISIMO%' OR nombre ILIKE '%AZUL TRADICIONAL%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Yeimi%' LIMIT 1),
  'Servicio técnico',
  'CP 06000',
  ARRAY['Mantenimiento Preventivo'],
  'El rack esta desacomodado y con polvo',
  'Limpieza preventiva',
  ARRAY['Se limpió el servidor, los equipos como switch, DVR y equipo de sonido. Al igual que se acomodó el cableado que se encuentra dentro del rack.'],
  '[{"tipo":"antes","descripcion":"El rack se encuentra desacomodado y lleno de polvo","urls":["https://drive.google.com/file/d/1d5mCqScIBpnGcT5IvrOavS7X23fsfLpF/view?usp=drivesdk","https://drive.google.com/file/d/1og2C1D4mV-GgN0mLc1U_-r_ayTv4AN4A/view?usp=drivesdk","https://drive.google.com/file/d/1e9UcO-NVIvN8sr7N_yiiOm1lI_goisGG/view?usp=drivesdk"]},{"tipo":"despues","descripcion":"Se limpió y acomodaron los cables para lograr cerrar por completo el rack","urls":["https://drive.google.com/file/d/140UF9VvtotMMIpP1PEdyhI4VDlzwwnEz/view?usp=drivesdk","https://drive.google.com/file/d/1e19zsLbvhcHPd6XDUxhV_u4Mcyc-RWme/view?usp=drivesdk","https://drive.google.com/file/d/1NvWioxJhobdSpEOAJpCgzmFdVOyGSo_-/view?usp=drivesdk","https://drive.google.com/file/d/1Yhy2qr3of-kbcLozebKAdJKkx7gX7qIz/view?usp=drivesdk"]}]'::jsonb,
  0, 0, 'completado', NULL;

-- ── RST-0060 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0060', '2026-03-08',
  (SELECT id FROM clientes WHERE nombre ILIKE '%AZUL HISTORICO%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Yeimi%' LIMIT 1),
  'Servicio técnico',
  'Isabel la Catolica 30',
  ARRAY['Mantenimiento Correctivo'],
  'DVR no lee el disco duro',
  'El disco duro ya se encuentra dañado',
  ARRAY['Se realizó un cambio de disco'],
  '[{"tipo":"antes","descripcion":"Dvr no lee el disco duro","urls":["https://drive.google.com/file/d/1Fupd7_mGJ5h0FqIJ2v4CxvCsrf11VNfy/view?usp=drivesdk"]},{"tipo":"despues","descripcion":"Se cambió el disco y se deja grabando.","urls":["https://drive.google.com/file/d/1_yupR0-8Lpv8pQyzXZ5-9-D4ZW6UAkId/view?usp=drivesdk","https://drive.google.com/file/d/1p0TXyt7QYmWCDMuV_K3IYFlf2k11UCdi/view?usp=drivesdk"]}]'::jsonb,
  0, 0, 'completado', NULL;

-- ── RST-0061 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0061', '2026-03-10',
  (SELECT id FROM clientes WHERE nombre ILIKE '%GRUPO CAL%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Edwin%' LIMIT 1),
  'Servicio técnico',
  'Vasco de Quiroga 1249, Santa Fe, Álvaro Obregón, 01260 Ciudad de México, CDMX',
  ARRAY['Soporte Técnico'],
  'Apoyo a migración de correos microsoft exchange',
  NULL,
  ARRAY[E'Migración y revision de correos en el área de ventas (bruno, eddie, etc) asi como iniciar sesión en el correo del Lic. Iñigo, apoyo en dudas y problemas referentes a correos con los usuarios y solución de problemas que surgieron durante el horario '],
  '[]'::jsonb,
  0, 0, 'en_proceso', NULL;

-- ── RST-0062 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0062', '2026-03-11',
  (SELECT id FROM clientes WHERE nombre ILIKE '%GRUPO CAL%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Edwin%' LIMIT 1),
  'Servicio técnico',
  'Vasco de Quiroga 1249, Santa Fe, Álvaro Obregón, 01260 Ciudad de México, CDMX',
  ARRAY['Soporte Técnico'],
  'Migración de correos openmarket',
  NULL,
  ARRAY[E'Migración de correos dominio openmarket a los usuarios Jafet, Nancy, Imelda, Viridiana, Alejandro.\nApoyo con correos pasados para Imelda y Socorro, asi como revision de sistema Sai, apoyo a Vendedores que dejan su equipo '],
  '[]'::jsonb,
  0, 0, 'en_proceso', NULL;

-- ── RST-0063 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0063', '2026-03-12',
  (SELECT id FROM clientes WHERE nombre ILIKE '%LUQROSS%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Yeimi%' LIMIT 1),
  'Servicio técnico',
  'CP 02020',
  ARRAY['Soporte Técnico'],
  E'1. Usuario Irma no puede guardar firma de correo en outlook.\n2. Capacitación para reproducir videos de cámaras en la bodega.\n3. Télefono de usuario Diego no entran llamadas.',
  E'1. La firma no se guarda, se tiene que configurar cada vez que se cierra el outlook.\n3. El télefono se pone en no molestar.',
  ARRAY[E'1. Se reconfiguró la firma, se instaló el outlook, se reeatablecieron las configuraciones y sigue sin poder funcionar la firma.\n2. Se capacitó al usuario Irma para el monitoreo y reproducción de videos.\n3. Se le desconfiguró el botón de no molestar.\n4. Entrega y configuración de equipo para usuario Emanuel.'],
  '[{"tipo":"despues","descripcion":"","urls":["https://drive.google.com/file/d/1mZeiREBzo7KCJVC41vWfmuL4I4VtxviK/view?usp=drivesdk"]},{"tipo":"antes","descripcion":"","urls":["https://drive.google.com/file/d/1SViHSkC_L4Lgt7_ouCcfVMfi2pFxZit4/view?usp=drivesdk","https://drive.google.com/file/d/1JDVDdyNVH9BXu1vENzDVYMuanyHEt4cq/view?usp=drivesdk"]}]'::jsonb,
  0, 0, 'completado',
  'La firma del correo del usuario Irma sigue sin poder guardarse, estaremos investigando como solucionar el problema.';

-- ── RST-0064 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0064', '2026-03-18',
  (SELECT id FROM clientes WHERE nombre ILIKE '%RESIDENCIAL%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Edwin%' LIMIT 1),
  'Servicio técnico',
  NULL,
  ARRAY['Mantenimiento Correctivo'],
  'Cámara 12 dejo de dar imagen',
  'Falla de configuración',
  ARRAY[E'In situ se llevó a cabo la inspección de la cámara, conexiones y prueba de voltaje, estando estas en buen estado, por lo que se realizo un reset con botón físico para restablecer resolución dando como resultado la obtención de la imagen nuevamente.\nEl administrador presente observó la camara en correcto funcionamiento.'],
  '[{"tipo":"antes","descripcion":"","urls":["https://drive.google.com/file/d/1rn4mJVBX3NAaPS3GfqTQX0337M1nnOZD/view?usp=drivesdk"]}]'::jsonb,
  300, 300, 'completado', 'Aparentemente hubo un apagón antes de dejar de dar imagen';

-- ── RST-0065 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0065', '2026-03-18',
  (SELECT id FROM clientes WHERE nombre ILIKE '%ZIEVEN%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Yeimi%' LIMIT 1),
  'Servicio técnico',
  'C. Gavilán 565, San Miguel, Iztapalapa, 09300 Ciudad de México, CDMX',
  ARRAY['Soporte Técnico'],
  E'1. El usuario necesita cambiar sus datos a otro equipo.\n2. Acceso a carpetas compartidas del servidor.\n3. No tiene office.\n4. No tiene adobe.\n5. Entrega de radios armados.',
  E'1. Inicio de sesión de cuenta en onedrive.\n2. Se le debe otorgar los permisos exclusivamente a cada usuario en el servidor.\n3. Instalación de los programas.',
  ARRAY[E'1. Se reconfiguró la cuenta del usuario en el nuevo equipo, al igual que se le pusieron las carpetas compartidas y se le instaló los programas de office y acrobat.\n2. Se le otorga permisos de carpetas a equipo de almacen, de Hector y al equipo de calidad.'],
  '[]'::jsonb,
  500, 500, 'completado', NULL;

-- ── RST-0066 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0066', '2026-03-19',
  (SELECT id FROM clientes WHERE nombre ILIKE '%LUQROSS%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Yeimi%' LIMIT 1),
  'Servicio técnico',
  'CP 02020',
  ARRAY['Soporte Técnico'],
  'Cambio de equipo',
  NULL,
  ARRAY[E'-Se respaldo datos de equipo de usuario anterior Steve Kadas.\n- Se instalaron los datos de usuario Victor Marquez a laptop.\n-Se instaló programa de cámaras a equipo de usuario Irma.'],
  '[]'::jsonb,
  0, 0, 'completado', NULL;

-- ── RST-0067 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0067', '2026-03-20',
  (SELECT id FROM clientes WHERE nombre ILIKE '%ZIEVEN%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Edwin%' LIMIT 1),
  'Servicio técnico',
  'C. Gavilán 565, San Miguel, Iztapalapa, 09300 Ciudad de México, CDMX',
  ARRAY['Mantenimiento Correctivo'],
  'Puerta de entrada eléctrica no funciona.',
  'Por uso, se desconecto la alimentación.',
  ARRAY['Reconexion de la alimentación y trenzado de cables','Instalación de camara de comedor en el dvr principal, asi como mover al dvr secundario la camara sustituida en el dvr principal'],
  '[]'::jsonb,
  0, 0, 'completado', NULL;

-- ── RST-0068 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0068', '2026-03-25',
  (SELECT id FROM clientes WHERE nombre ILIKE '%prueba%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Aldrich%' LIMIT 1),
  'Servicio técnico',
  'Locura esquina con esquizofrenia, Col. Demencia, codigo postal 08800. Ciudad trastornos mentales',
  ARRAY['Mantenimiento Correctivo','Soporte Técnico'],
  'Falla al poner imágenes desde el celular',
  'Ando probando',
  ARRAY['Modificación del código'],
  '[{"tipo":"despues","descripcion":"Un acercamiento a mi compa que no perdona","urls":["https://drive.google.com/file/d/1ABTRaWE1OL131-K5-4lznNSI8dRJolg7/view?usp=drivesdk","https://drive.google.com/file/d/1QivPoBjyUdArsYjKPu23Agw3RsU0tZ1J/view?usp=drivesdk"]},{"tipo":"antes","descripcion":"Mi compa bailando","urls":["https://drive.google.com/file/d/1YznBrHgnZPZflsWWH13___IYlpJNJ-TH/view?usp=drivesdk"]}]'::jsonb,
  0, 0, 'en_proceso', 'Ese compa gloton';

-- ── RST-0069 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0069', '2026-03-25',
  (SELECT id FROM clientes WHERE nombre ILIKE '%LUQROSS%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Edwin%' LIMIT 1),
  'Servicio técnico',
  'CP 02020',
  ARRAY['Soporte Técnico'],
  'Cambio de monitor',
  NULL,
  ARRAY[E'Se realizo el cambio del monitor de la usuaria Leslie, por el anterior monitor de Irma (Monitor Actek). \nA su vez, por petición de Irma, se realizo el cambio de posición del CPU de la misma usuaria, estaba colocado en el escritorio, acomodándose actualmente debajo del mismo, junto al UPS.'],
  '[]'::jsonb,
  0, 0, 'completado', NULL;

-- ── RST-0070 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0070', '2026-03-31',
  (SELECT id FROM clientes WHERE nombre ILIKE '%AZUL CONDESA%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Yeimi%' LIMIT 1),
  'Servicio técnico',
  'Av. Nuevo León 68, Hipódromo, Cuauhtémoc, 06100 Ciudad de México, CDMX',
  ARRAY['Reparación'],
  E'- Batería de laptop no funciona\n- Se pasma demasiado',
  E'- La batería ya esta deteriorada.\n- Tiene poca memoria RAM.',
  ARRAY[E'- Se realizó cambio de batería.\n- Se instaló memoria RAM de 16 GB'],
  '[{"tipo":"antes","descripcion":"Sin piezas nuevas","urls":["https://drive.google.com/file/d/13mOgKqKP2Z_3H_RVCBhiNxaHZ_zb7zYJ/view?usp=drivesdk"]},{"tipo":"despues","descripcion":"Instalación de componentes nuevos.","urls":["https://drive.google.com/file/d/1ALD51ORJkbSL_Ec9o8rG2Xz-C0PSdgE_/view?usp=drivesdk"]}]'::jsonb,
  0, 0, 'completado', NULL;

-- ── RST-0071 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0071', '2026-04-15',
  (SELECT id FROM clientes WHERE nombre ILIKE '%LANCERO%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%David%' LIMIT 1),
  'Servicio técnico',
  'C. José María Morelos 713, Zona Centro, 44100 Guadalajara, Jal.',
  ARRAY['Soporte Técnico'],
  'Falta de Programas Microsoft Office',
  'Instalar normalmente',
  ARRAY['Se realizó la instalación normal de Microsoft Word, Excel y PowerPoint'],
  '[{"tipo":"despues","descripcion":"","urls":["https://drive.google.com/file/d/1SKYxxoDH5qqcA3SqbNl0DNXCsg-uAyJu/view?usp=drivesdk"]}]'::jsonb,
  100, 100, 'completado', NULL;

-- ── RST-0072 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0072', '2026-04-15',
  (SELECT id FROM clientes WHERE nombre ILIKE '%SINOSUPPLY%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%David%' LIMIT 1),
  'Servicio técnico',
  NULL,
  ARRAY['Soporte Técnico'],
  'Falta de Programas Office',
  'Instalar Office de manera normal',
  ARRAY['Se instalo Office de manera normal y se activó'],
  '[{"tipo":"antes","descripcion":"","urls":["https://drive.google.com/file/d/1m8aHOG-HLKfi_UNNOgJJH50KtOPcW3zN/view?usp=drivesdk","https://drive.google.com/file/d/1iDsHdBql0lxCAgx-CYgBnicNjgjO6psF/view?usp=drivesdk","https://drive.google.com/file/d/1bRL02ER-ZCrD7sRVuqtdSayyoYK5jbj-/view?usp=drivesdk"]},{"tipo":"despues","descripcion":"","urls":["https://drive.google.com/file/d/1mryPLsrAq81ptZTXhd6rVFvhRw-l9YAx/view?usp=drivesdk","https://drive.google.com/file/d/15d-pMJ_GV8ABx5un6-F8jmp8UWGQ4L/view?usp=drivesdk"]}]'::jsonb,
  0, 0, 'completado', NULL;

-- ── RST-0073 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0073', '2026-04-17',
  (SELECT id FROM clientes WHERE nombre ILIKE '%SINOSUPPLY%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%David%' LIMIT 1),
  'Servicio técnico',
  NULL,
  ARRAY['Soporte Técnico'],
  'Falta de Programas de Office',
  'Instalar Office',
  ARRAY['Se intaló Office de manera normal y se activó'],
  '[{"tipo":"antes","descripcion":"","urls":["https://drive.google.com/file/d/1HsBs2kLT8tBFkuC3qXmWY8OuOsmUtFTz/view?usp=drivesdk","https://drive.google.com/file/d/1rqpN0t8SEOO6M_asSvhz5YEK2-p2TGFL/view?usp=drivesdk","https://drive.google.com/file/d/1UWz30hk9suJraeE-BNQim1ojgDpHRcaW/view?usp=drivesdk"]},{"tipo":"despues","descripcion":"","urls":["https://drive.google.com/file/d/1fY4BJJVrtZ20FjSbZ0CHg2whped7mx8I/view?usp=drivesdk"]}]'::jsonb,
  0, 0, 'completado', NULL;

-- ── RST-0074 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0074', '2026-04-18',
  (SELECT id FROM clientes WHERE nombre ILIKE '%SINOSUPPLY%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%David%' LIMIT 1),
  'Servicio técnico',
  NULL,
  ARRAY['Soporte Técnico'],
  'Equipo muy lento al usar pocos programas',
  'El sistema Windows le otorgó mas de 4gb de ram a la grafica dedicada por lo que la memoria Ram estaba al limite en todo momento',
  ARRAY[E'- Se modifico la configuracion en ms config para quitarle esa ram dedicada a la grafica integrada logrando liberarla y hacer el equipo capaz de realizar mas tareal al mismo tiempo. Esto se realizó en tres equipos:\n1301147168\n284493746\n1137944622'],
  '[{"tipo":"antes","descripcion":"","urls":["https://drive.google.com/file/d/1j3neN2zvRfjXb7ST_rbbA_B2EowrnHc9/view?usp=drivesdk","https://drive.google.com/file/d/1LJbZeiRixA5RRbPjfk6imwx0M8HVgnSY/view?usp=drivesdk","https://drive.google.com/file/d/1dTc91Dw2U4rOZzYpBa8I71uEhhqLLGEj/view?usp=drivesdk","https://drive.google.com/file/d/1XmD06WCRVSRQtYUHF3qLPl2WW1NBnldM/view?usp=drivesdk"]},{"tipo":"despues","descripcion":"","urls":["https://drive.google.com/file/d/1tq4zD4VR1zzBjF5SdFoPoy4z6LuZauBI/view?usp=drivesdk","https://drive.google.com/file/d/1CpK9Ptp4zG1_GV0uyVeuWkutmeaio7JD/view?usp=drivesdk","https://drive.google.com/file/d/1gcOXrySA0y2Y2rg0hD514zYSAlWtcLJj/view?usp=drivesdk","https://drive.google.com/file/d/1u_YFjKkDIuM1CzQW7-tx7fA0ORGFvq2c/view?usp=drivesdk","https://drive.google.com/file/d/1g32IiHf1Ocir7oGNHFMgC6tcPfrDnYOq/view?usp=drivesdk","https://drive.google.com/file/d/1zmFbONkY4x8bxSU9Rr16_cqC1GpCriV9/view?usp=drivesdk"]}]'::jsonb,
  0, 0, 'completado', NULL;

-- ── RST-0075 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0075', '2026-04-24',
  (SELECT id FROM clientes WHERE nombre ILIKE '%SINO OCEAN%' OR nombre ILIKE '%Sino Ocean%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Pablo%' LIMIT 1),
  'Servicio técnico',
  'C. 20 Sur 1302, Azcarate, 72501 Heroica Puebla de Zaragoza, Pue',
  ARRAY['Soporte Técnico'],
  'no enciende computadora',
  'Disco duro dañado',
  ARRAY['Se le envia un disco duro con el sistema operativo cargado y paqueteria de office','MAntenimientos remotos a equipos de sucursal Morelos'],
  '[]'::jsonb,
  1750, 1750, 'completado', NULL;

INSERT INTO reporte_items (reporte_id, descripcion, cantidad, precio_unitario, subtotal)
SELECT r.id, 'Cambio de Disco duro',          1, 1450.00, 1450.00 FROM reportes r WHERE r.folio = 'RST-0075'
UNION ALL
SELECT r.id, 'Mantenimientos en Sucursal Morelos', 1, 300.00, 300.00 FROM reportes r WHERE r.folio = 'RST-0075';

-- ── RST-0077 (RT0076 no existe en el CSV original) ──────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0077', '2026-04-18',
  (SELECT id FROM clientes WHERE nombre ILIKE '%LANCERO%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Pablo%' LIMIT 1),
  'Servicio técnico',
  'Alba 1565, Lomas de San Pedrito, 45580 San Pedro Tlaquepaque, Jal.',
  '{}'::TEXT[],
  'Equipos lentos y con virus',
  'Se carga sistema operativo',
  ARRAY['Se formatean 3 equipos de tecnicos y se carga sistemas operativos adecuados para los equipos','Se configura impresora'],
  '[]'::jsonb,
  600, 600, 'en_proceso', NULL;

-- ── RST-0078 ────────────────────────────────────────────────
INSERT INTO reportes (folio, fecha_ingreso, cliente_id, tecnico_id, equipo,
  direccion_servicio, tipo_servicio, falla_reportada, diagnostico,
  trabajos_realizados, evidencias, subtotal, total, estado, observaciones)
SELECT
  'RST-0078', '2026-04-22',
  (SELECT id FROM clientes WHERE nombre ILIKE '%SINOSUPPLY%' LIMIT 1),
  (SELECT id FROM usuarios WHERE nombre ILIKE '%Edwin%' LIMIT 1),
  'Servicio técnico',
  'C. Álvaro Obregón 81, Santa Anita, Iztacalco, 08300 Ciudad de México, CDMX',
  ARRAY['Mantenimiento Correctivo','Soporte Técnico'],
  'Falla en el AP de Técnicos, cámara que no da imagen y acondicionar equipo para nuevo vendedor',
  NULL,
  ARRAY[E'Reconexión del AP de los Técnicos, revisión de cámaras descubriendo que estaba desconectada y realizando su respectiva reconexión.\na su vez se realizo la configuración de un equipo para utilizar por el nuevo vendedor, instalación de office y colocación de antena WIFI.\nFormateo de 10 teléfonos empresariales para reasignación.'],
  '[{"tipo":"antes","descripcion":"","urls":["https://drive.google.com/file/d/1LDtuuZi94vsu2qIKjvhw2HyVVKvYottM/view?usp=drivesdk","https://drive.google.com/file/d/1gfiz9EgUnhgecOD5jtapr2IbZ1FeW5pN/view?usp=drivesdk"]}]'::jsonb,
  0, 0, 'completado', NULL;

-- ── Verificación ─────────────────────────────────────────────
SELECT folio, fecha_ingreso, estado, total,
       (SELECT nombre FROM clientes WHERE id = r.cliente_id) AS cliente,
       (SELECT nombre FROM usuarios WHERE id = r.tecnico_id) AS tecnico
FROM reportes r
WHERE folio LIKE 'RST-005%' OR folio LIKE 'RST-006%' OR folio LIKE 'RST-007%'
ORDER BY folio;

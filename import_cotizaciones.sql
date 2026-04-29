-- =============================================================
-- IMPORTACIÓN HISTÓRICA: Cotizaciones 85–133 (sin 98)
-- =============================================================
-- PASO 1: Obtén tu UUID ejecutando primero:
--   SELECT id FROM auth.users WHERE email = 'tu@email.com';
-- PASO 2: Reemplaza '9f02f84e-87fb-410e-8d69-77509c95a28c' en todo el archivo con ese UUID
-- PASO 3: Ejecuta el script completo en el SQL Editor de Supabase
-- =============================================================

BEGIN;

-- ── CORREGIR CONSTRAINT DE ESTADO (el schema original tenía menos valores) ────
ALTER TABLE cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;
ALTER TABLE cotizaciones ADD CONSTRAINT cotizaciones_estado_check
  CHECK (estado IN ('borrador','pendiente','enviada','aprobada','aceptada','rechazada','facturada','cancelada','pagada'));

-- ── COTIZACIONES ──────────────────────────────────────────────────────────────

INSERT INTO cotizaciones (
  id, folio, cliente_id, fecha, estado,
  aplica_iva, iva_porcentaje, subtotal, iva_monto, total,
  ganancia_total, elaborado_por, quien_es_el_cliente,
  direccion_entrega, contactos_cotizacion, notas,
  created_by, created_at, updated_at
) VALUES

(85,'COT-0085',3,'2026-03-03','pagada',true,16,1500,240,1740,1343.9,
 NULL,'Didara',
 'Calle imaginaria #32, col. Arcoiris 077777. Imaginacion',
 '[{"nombre":"Pesadilla","telefono":"66613129","email":"buuuu@gmail.com","puesto":"Espantar"}]',
 'blablablajejeje','9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(86,'COT-0086',34,'2026-03-04','pagada',false,0,4500,0,4500,533.59,
 'Yeimi Viridiana Melo Domingo','Didara',NULL,
 '[{"nombre":"","telefono":"","email":"rosalba.azulrestaurantes@gmail.com","puesto":""}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(87,'COT-0087',4,'2026-03-06','rechazada',false,0,3900,0,3900,3900,
 'Yeimi Viridiana Melo Domingo','Didara',
 'C. Álvaro Obregón 81, Santa Anita, Iztacalco, 08300 Ciudad de México, CDMX',
 NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(88,'COT-0088',39,'2026-03-06','cancelada',false,0,3700,0,3700,2569.89,
 'Yeimi Viridiana Melo Domingo','Didara',NULL,NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(89,'COT-0089',39,'2026-03-06','pagada',false,0,3800,0,3800,1492.68,
 'Yeimi Viridiana Melo Domingo','Didara',NULL,NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(90,'COT-0090',39,'2026-03-11','pagada',false,0,5720.32,0,5720.32,1167.81,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,
 'Cotización condominio','9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(91,'COT-0091',39,'2026-03-11','pendiente',true,16,1300,208,1508,500,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(92,'COT-0092',11,'2026-03-11','pagada',false,0,11500,0,11500,2180.52,
 'Yeimi Viridiana Melo Domingo','Didara',NULL,
 '[{"nombre":"ARISTEO VIVARA","telefono":"","email":"facturacion@luqross.com","puesto":""}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(93,'COT-0093',2,'2026-03-13','pendiente',true,16,13896.56,2223.45,16120.01,1086.216,
 'Pablo Alexander Ramirez Herrera','Didara',
 'Vasco de Quiroga 1249, Santa Fe, Álvaro Obregón, 01260 Ciudad de México, CDMX',
 '[{"nombre":"Jafet Duran","telefono":"55 7657 4308","email":"gerenciadeoperaciones@grupocal.mx","puesto":"Finanzas"},{"nombre":"Zully Pascacio","telefono":"","email":"administracion@grupocal.com.mx","puesto":""}]',
 E'-Se propone liquidar en su totalidad la cotizacion para conservar el precio en los U7 PRO\n-Producto en disponibilidad inmediata',
 '9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(94,'COT-0094',47,'2026-03-17','cancelada',true,16,192,30.72,222.72,239,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(95,'COT-0095',14,'2026-03-18','pagada',true,16,3024,483.84,3507.84,1019.76,
 'Pablo Alexander Ramirez Herrera','Didara',
 'C. Gavilán 565, San Miguel, Iztapalapa, 09300 Ciudad de México, CDMX',
 NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(96,'COT-0096',39,'2026-03-18','aceptada',false,0,2000,0,2000,0,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,
 E'1.- Mover tuberia y 2 camaras hubicadas al fondo del condominio\n2.- Mover la camara que esta frente a salon de eventos',
 '9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(97,'COT-0097',46,'2026-03-19','aceptada',false,0,4950,0,4950,983.59,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(99,'COT-0099',11,'2026-03-19','pagada',false,0,37800,0,37800,6262.5,
 'Pablo Alexander Ramirez Herrera','Didara',
 'Antigua Calz. de Guadalupe 105, San Marcos, Azcapotzalco, 02020 Ciudad de México, CDMX',
 NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(100,'COT-0100',4,'2026-03-19','aceptada',false,0,4665,0,4665,3382.93,
 'Pablo Alexander Ramirez Herrera','Didara',
 'C. Álvaro Obregón 81, Santa Anita, Iztacalco, 08300 Ciudad de México, CDMX',
 NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(101,'COT-0101',35,'2026-03-19','facturada',false,0,2600,0,2600,970.1,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(102,'COT-0102',34,'2026-03-19','pagada',true,16,1344,215.04,1559.04,431.48,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,
 '[{"nombre":"","telefono":"","email":"rosalba.azulrestaurantes@gmail.com","puesto":""}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(103,'COT-0103',46,'2026-03-20','aceptada',false,0,3300,0,3300,919,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(104,'COT-0104',4,'2026-03-20','pagada',false,0,6000,0,6000,1115.05,
 'Pablo Alexander Ramirez Herrera','Didara',
 'C. Álvaro Obregón 81, Santa Anita, Iztacalco, 08300 Ciudad de México, CDMX',
 NULL,'Fecha estimada de instalación Martes 24 de marzo de 2026',
 '9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(105,'COT-0105',3,'2026-03-25','cancelada',true,16,1.4,0.22,1.62,2,
 'Aldrich Palacios Goicochea','Didara',
 'Locura esquina con esquizofrenia, Col. Demencia, codigo postal 08800. Ciudad trastornos mentales',
 '[{"nombre":"Alzheimer","telefono":"44568962","email":"que_paso_ayer@hotmail.com","puesto":"desorientar"}]',
 'probando correo automatico y ganancias','9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(106,'COT-0106',11,'2026-03-25','pagada',false,0,1200,0,1200,315.84,
 'Yeimi Viridiana Melo Domingo','Didara',NULL,
 '[{"nombre":"Denisse Marin","telefono":"5519925117","email":"recepcion@luqross.com","puesto":"Recepción"}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(107,'COT-0107',33,'2026-03-25','pagada',false,0,3850,0,3850,1095.64,
 'Yeimi Viridiana Melo Domingo','Didara',NULL,
 '[{"nombre":"DIEGO GARCÍA","telefono":"","email":"cuentascondesa@gmail.com","puesto":""},{"nombre":"","telefono":"","email":"rosalba.azulrestaurantes@gmail.com","puesto":""}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(108,'COT-0108',39,'2026-03-25','pendiente',false,0,23750,0,23750,10896.58,
 'Yeimi Viridiana Melo Domingo','Didara',NULL,NULL,
 E'- Se requiere el 70% de anticipo.\n- 4 días hábiles para entrega total de instalación.\n- Vigencia de cotización 30 días.\nAl aprobar la cotización se negociará la fecha de inicio de instalación sujeto a disponibilidad del proveedor.',
 '9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(109,'COT-0109',48,'2026-03-26','pagada',false,0,1700,0,1700,0,
 'Pablo Alexander Ramirez Herrera','Didara',
 'Carlos B. Zetina 30, Hipódromo Condesa, Cuauhtémoc, C.P. 06170 Ciudad de México, CDMX',
 '[{"nombre":"Alejandra Martinez","telefono":"5539062812","email":"mumumart@yahoo.com.mx","puesto":"Administradora"}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(110,'COT-0110',11,'2026-03-26','pagada',false,0,620,0,620,167.56,
 'Pablo Alexander Ramirez Herrera','Didara',
 'Antigua Calz. de Guadalupe 105, San Marcos, Azcapotzalco, 02020 Ciudad de México, CDMX',
 '[{"nombre":"Denisse Marin","telefono":"5519925117","email":"recepcion@luqross.com","puesto":"Recepción"}]',
 'Incluye IVA','9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(111,'COT-0111',2,'2026-03-26','pagada',false,0,4800,0,4800,1300,
 'Pablo Alexander Ramirez Herrera','Didara',
 'Vasco de Quiroga 1249, Santa Fe, Álvaro Obregón, 01260 Ciudad de México, CDMX',
 '[{"nombre":"Jafet Duran","telefono":"55 7657 4308","email":"gerenciadeoperaciones@grupocal.mx","puesto":"Finanzas"},{"nombre":"Zully Pascacio","telefono":"","email":"administracion@grupocal.com.mx","puesto":""}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(112,'COT-0112',2,'2026-03-26','pagada',false,0,1760,0,1760,0,
 'Pablo Alexander Ramirez Herrera','Didara',
 'Vasco de Quiroga 1249, Santa Fe, Álvaro Obregón, 01260 Ciudad de México, CDMX',
 '[{"nombre":"Jafet Duran","telefono":"55 7657 4308","email":"gerenciadeoperaciones@grupocal.mx","puesto":"Finanzas"},{"nombre":"Zully Pascacio","telefono":"","email":"administracion@grupocal.com.mx","puesto":""}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(113,'COT-0113',39,'2026-03-26','pendiente',false,0,19710.32,0,19710.32,3743.58,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,
 E'Tiempo de entrega 4 dias\nAnticipo del 70%\nVigencia de cotizacion 30 dias\nSe recomienda el uso de tuberia para mayor duracion de la instalacion\nFecha de inicio se ajustara de acuerdo a disponibilidad',
 '9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(114,'COT-0114',11,'2026-03-26','pagada',false,0,12600,0,12600,2087.5,
 'Pablo Alexander Ramirez Herrera','Didara',
 'Antigua Calz. de Guadalupe 105, San Marcos, Azcapotzalco, 02020 Ciudad de México, CDMX',
 '[{"nombre":"Denisse Marin","telefono":"5519925117","email":"recepcion@luqross.com","puesto":"Recepción"}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(115,'COT-0115',33,'2026-04-01','pagada',false,0,1800,0,1800,301.66,
 'Yeimi Viridiana Melo Domingo','Didara',NULL,
 '[{"nombre":"DIEGO GARCÍA","telefono":"","email":"cuentascondesa@gmail.com","puesto":""},{"nombre":"","telefono":"","email":"rosalba.azulrestaurantes@gmail.com","puesto":""}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(116,'COT-0116',46,'2026-03-31','pendiente',false,0,18755,0,18755,4970.2,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(117,'COT-0117',39,'2026-04-07','pendiente',false,0,6000,0,6000,2593.15,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,
 'Instalacion casa de Ingeniero Ballado colocar 2 AP sobre canalizacion previamente realizada',
 '9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(118,'COT-0118',35,'2026-04-08','pagada',false,0,1700,0,1700,430,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,
 'Incluye IVA','9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(119,'COT-0119',46,'2026-04-08','pendiente',false,0,9715,0,9715,3833.42,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(120,'COT-0120',46,'2026-04-08','pendiente',false,0,12055,0,12055,6120.37,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(121,'COT-0121',28,'2026-04-11','pendiente',false,0,19000,0,19000,11710,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,
 E'Los equipos se enviaran por paqueteria previamente configurados\nprecio incluye IVA',
 '9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(122,'COT-0122',7,'2026-04-08','pendiente',false,0,1800,0,1800,800,
 'Pablo Alexander Ramirez Herrera','Didara',
 'San Francisco Tetecala, 02730 Ciudad de México, CDMX',
 NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(123,'COT-0123',39,'2026-04-13','pendiente',false,0,5551.71,0,5551.71,2901.948,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,
 'Instalacion en Cafe Conciencia','9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(124,'COT-0124',7,'2026-04-13','aceptada',false,0,4246.58,0,4246.58,1366.026,
 'Pablo Alexander Ramirez Herrera','Didara',
 'San Francisco Tetecala, 02730 Ciudad de México, CDMX',
 NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(125,'COT-0125',7,'2026-04-14','pendiente',false,0,3000,0,3000,825.76,
 'Pablo Alexander Ramirez Herrera','Didara',
 'San Francisco Tetecala, 02730 Ciudad de México, CDMX',
 NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(126,'COT-0126',11,'2026-04-15','pagada',false,0,6700,0,6700,3599.84,
 'Pablo Alexander Ramirez Herrera','Didara',
 'Antigua Calz. de Guadalupe 105, San Marcos, Azcapotzalco, 02020 Ciudad de México, CDMX',
 '[{"nombre":"ARISTEO VIVARA","telefono":"5531472058","email":"facturacion@luqross.com","puesto":"Contabilidad"},{"nombre":"Denisse Marin","telefono":"5519925117","email":"recepcion@luqross.com","puesto":"Recepción"}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(127,'COT-0127',5,'2026-04-15','pendiente',false,0,127360.03,0,127360.03,59416.93,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(128,'COT-0128',35,'2026-04-17','pendiente',true,16,8620.99,1379.36,10000.35,3256.81,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,
 'Tiempo de entrega estimado: Una semana.','9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(129,'COT-0129',35,'2026-04-17','pendiente',true,16,0,0,0,0,
 'Pablo Alexander Ramirez Herrera','Didara',
 'Venustiano Carranza #57, Centro Histórico, CP 06000',
 NULL,NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(130,'COT-0130',39,'2026-04-18','pendiente',false,0,6900,0,6900,2810.8,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,
 'Camaras 4k para Condominio Agustin Delgado con una vision de 50 metros',
 '9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(131,'COT-0131',39,'2026-04-18','pendiente',false,0,44300,0,44300,26876.84,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,
 'Instalación de en 4 elevadores incluye control de acceso y camara anti bandalica en el elevador',
 '9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(132,'COT-0132',39,'2026-04-23','pendiente',false,0,5000,0,5000,3034,
 'Pablo Alexander Ramirez Herrera','Didara',NULL,NULL,
 'Precios ya incluyen IVA','9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW()),

(133,'COT-0133',28,'2026-04-24','pendiente',false,0,8087.25,0,8087.25,4241.04,
 'Pablo Alexander Ramirez Herrera','Didara',
 'Alba 1565, Lomas de San Pedrito, 45580 San Pedro Tlaquepaque, Jal.',
 '[{"nombre":"Rosalba","telefono":"+52 1 33 2162 0434","email":"sinosupply115@gmail.com","puesto":""}]',
 NULL,'9f02f84e-87fb-410e-8d69-77509c95a28c',NOW(),NOW());


-- ── ÍTEMS ─────────────────────────────────────────────────────────────────────

INSERT INTO cotizacion_items (
  cotizacion_id, tipo, descripcion, cantidad, precio_unitario,
  precio_compra, descuento, subtotal, producto_id
) VALUES

-- COT-85
(85,'producto','4 Cámaras bullet metálicas / Fuente de Poder / Accesorios de Instalación',1,2000,NULL,50,1000,NULL),
(85,'servicio','Costo de Instalación',1,2000,NULL,0,2000,NULL),

-- COT-86
(86,'producto','Disco Duro PURPLE de 6TB',1,4500,NULL,0,4500,NULL),

-- COT-87
(87,'servicio','Disco de estado solido externo 2 Tb',1,3900,NULL,0,3900,NULL),

-- COT-88
(88,'producto','Disco Solido 240 Gb Wester Digital',1,1200,800,0,1200,NULL),
(88,'servicio','Monitor AOC Modelo 22B35HM23 Brillo 250 cd/m2 (Typical)',1,1700,NULL,0,1700,NULL),
(88,'producto','Kit Teclado Estándar y Mouse ACTECK AC-928984',1,200,145,0,200,NULL),
(88,'producto','ADAPTADOR USB INALÁMBRICO AC600 TP-LINK ARCHER T2U NANO CON DOBLE BANDA',1,250,185.11,0,250,NULL),
(88,'servicio','Gastos adicionales',1,200,0,0,200,NULL),
(88,'producto','Soporte Remoto',1,150,0,0,150,NULL),

-- COT-89
(89,'producto','Disco Solido 240 Gb Wester Digital',1,1200,NULL,0,1200,NULL),
(89,'servicio','Monitor AOC Modelo 22B35HM23 Brillo 250 cd/m2 (Typical)',1,1700,NULL,0,1700,NULL),
(89,'producto','Kit Teclado Estándar y Mouse ACTECK AC-928984',1,200,NULL,0,200,NULL),
(89,'producto','ADAPTADOR USB INALÁMBRICO AC600 TP-LINK ARCHER T2U NANO CON DOBLE BANDA',1,250,NULL,0,250,NULL),
(89,'servicio','Instalación de disco duro, limpieza fisica, instalación de sistema operativo y programas.',1,450,NULL,0,450,NULL),

-- COT-90
(90,'producto','Camara bala 2 Mp Dahua',4,327.58,258.42,0,1310.32,NULL),
(90,'producto','DVR 8 canales Hikvision',1,950,624.25,0,950,NULL),
(90,'producto','Fuente de Alimentación de 4 Salidas Epcom',1,300,196.58,0,300,NULL),
(90,'producto','Disco Duro New Pull 1 TB',1,800,530,0,800,NULL),
(90,'servicio','MAteriales de instalacion y conectores de camara',1,800,800,0,800,NULL),
(90,'producto','Cable UTP 100% cobre',80,7,4.6,0,560,NULL),
(90,'servicio','Costo de Instalación',1,1000,1000,0,1000,NULL),

-- COT-91
(91,'producto','Camara WiFi incluye SD de 64 GB e instalacion',1,1300,800,0,1300,NULL),

-- COT-92
(92,'producto','Laptop HP 255R 15.6 Pulgadas (C7GN5AT#ABM). Procesador AMD Ryzen 5 7535U, 8GB RAM, SSD512GB, Windows 11 PRO',1,11500,9319.48,0,11500,NULL),

-- COT-93
(93,'producto','Access Point UniFi WiFi 7 Pro / Soporta 6 GHz / para Interior en Techo o Pared / 6 streams / MU-MIMO 2x2 en cada banda / Multi-Link Operation / Puerto 2.5 GbE. NO incluye POE+',3,3965.52,3603.448,0,11896.56,NULL),
(93,'servicio','Instalacion con tubo galvanizado 1/2 pulgadas para Acces Point en recepción y en sala de juntas principal',1,2000,2000,0,2000,NULL),

-- COT-94
(94,'producto','actualizar secciones',1,300,1,20,240,NULL),

-- COT-95
(95,'producto','Radio Portátil TX600',4,900,501.06,16,3024,NULL),

-- COT-96
(96,'servicio','Reubicación de 4 camaras en condominio Agustin delgado',1,2000,2000,0,2000,NULL),

-- COT-97
(97,'producto','Disco Duro PURPLE de 6TB',1,4500,3966.41,-10,4950,NULL),

-- COT-99
(99,'producto','Procesador Intel Core i3-N305, Memoria RAM 8 GB, Disco Duro SSD 512 GB, Pantalla IPS FHD de 23.8 pulgadas, Gráficos Intel UHD integrados, Windows 11',3,12600,10512.5,0,37800,NULL),

-- COT-100
(100,'producto','Punto de acceso Wi-Fi Grandstream',1,1615,1282.07,0,1615,NULL),
(100,'servicio','Recuperacion de cableado de red en oficina de ventas y configuracion de Acces Point',1,1000,0,0,1000,NULL),
(100,'servicio',E'-Reparacion de 2 camaras\n-configuración de impresora en red\n-instalacion de office para 2 computadoras\n-Revisión de 2 computadoras mojadas',1,600,0,0,600,NULL),
(100,'servicio',E'Visita 6/04/26\n-Revision de 10 celulares\n-Activacion de 2 office\n-migracion de información para equipo de Ilse',1,400,0,0,400,NULL),
(100,'servicio','Cargadores de para computadora HP',3,350,0,0,1050,NULL),

-- COT-101
(101,'producto','[Dual Light] HiLook Series / Domo IP de 4 Megapixel / Uso en interior / Lente 2.8 mm / 20 mts IR + 20 mts Luz Blanca / Micrófono Integrado / ACUSENSE Lite / PoE / dWDR / H.265+ / ONVIF',2,1300,814.95,0,2600,NULL),

-- COT-102
(102,'producto','Router Gigabit VPN / Balanceador de cargas / 30,000 sesiones NAT / 6 puertos 10/100/1000 Mbps (WAN/LAN) / Compatible con GWN Cloud.',1,1600,912.52,16,1344,NULL),

-- COT-103
(103,'producto','Terminal Min Moe WiFi con Batería de Respaldo / Administrable por Smartphone o Nube / Acceso y Asistencia / Huella, Facial y Tarjetas MIFARE / 500 rostros y 1,000 Huellas y Tarjetas / Detección de Cubrebocas / HikConnect / HIK-IA',1,2300,1381,0,2300,NULL),
(103,'servicio','Capacitacion para el uso de equipo y administracion',1,1000,1000,0,1000,NULL),

-- COT-104
(104,'producto','Camara Domo 2mp Dahua',1,390,280.19,0,390,NULL),
(104,'producto','Fuente PREMIUM 11-15 V 18 canales EPCOM',1,1800,1226.76,0,1800,NULL),
(104,'producto','Cable UTP 100% cobre',180,7,4.6,0,1260,NULL),
(104,'servicio','Costo de Instalación',1,2300,2300,0,2300,NULL),
(104,'servicio','Materiales de instalacion, cajas para camaras y conectores para cajas',1,250,250,0,250,NULL),

-- COT-105
(105,'servicio','pruebas',1,2,0,0,2,NULL),

-- COT-106
(106,'producto','Kit Teclado y Mouse DELL Inalámbrico KM3322W 580-AKCU',2,600,442.08,0,1200,NULL),

-- COT-107
(107,'producto','Memoria DDR4 de 16GB SODIMM 3200MHz ADATA',1,2350,1754.36,0,2350,NULL),
(107,'producto','Bateria Original Dell Yrdd6',1,1500,1000,0,1500,NULL),

-- COT-108
(108,'producto','Camara IP Domo de 4 Megapixeles / Lente de 2.8mm / IR de 30 Mts / H.265 / WDR Real / IP67 / PoE',3,1600,1178.95,0,4800,NULL),
(108,'producto','Switch PoE de 6 Puertos Fast Ethernet / 4 Puertos PoE 10/100 / 36W Totales / 2 Uplinks / PoE Watchdog / hasta 250mts UTP CAT 6',1,600,425,0,600,NULL),
(108,'producto','tubo conduit ligero ro 13 mm (1/2)',50,26,19.35,0,1300,NULL),
(108,'servicio','Material para fijar tubo PVC, conexiones de tubo, cajas.',1,1000,500,0,1000,NULL),
(108,'producto','Cable UTP 100% cobre',150,7,4.6,0,1050,NULL),
(108,'producto','Brazo de pared para camaras domo DAHUA',3,300,194.48,0,900,NULL),
(108,'producto','Lámpara Led Solar Exterior Suburbana Alumbrado Público 20000 W',3,1700,1398,0,5100,NULL),
(108,'producto','Reflectores Lampara Led Exterior Alta Potencia 2500w',3,1000,652.21,0,3000,NULL),
(108,'servicio','Instalación de cámaras y reflectores',1,6000,0,0,6000,NULL),

-- COT-109
(109,'servicio','Cableado electrico desde tablero electrico hasta fuente de voltaje que alimenta el control de acceso. Se contempla canaleta e instalación estetica.',1,1700,1700,0,1700,NULL),

-- COT-110
(110,'producto','Diadema c/microfono USB',2,310,226.22,0,620,NULL),

-- COT-111
(111,'producto','Toner HP 58x impresora alejandro',1,4800,3500,0,4800,NULL),

-- COT-112
(112,'servicio','Se instala Nodo de red y contacto eléctrico para nuevo lugar de Alejandro',1,1760,1760,0,1760,NULL),

-- COT-113
(113,'producto','Disco Duro PURPLE de 6TB',1,4500,3966.41,0,4500,NULL),
(113,'producto','Camara bala 2 Mp Dahua',4,327.58,258.42,0,1310.32,NULL),
(113,'producto','Transceptores Dahua',4,75,40.47,0,300,NULL),
(113,'producto','Conector macho de voltaje',4,20,13.52,0,80,NULL),
(113,'producto','Fuente de Alimentación de 4 Salidas Epcom',1,300,196.58,0,300,NULL),
(113,'producto','DVR 16 canales 1080p Dahua',1,2400,1565.11,0,2400,NULL),
(113,'producto','tubo conduit ligero ro 13 mm (1/2)',60,26,19.35,0,1560,NULL),
(113,'servicio','Material para fijar tubo PVC, conexiones de tubo, cajas.',2,1000,500,0,2000,NULL),
(113,'producto','Cable UTP 100% cobre',180,7,4.6,0,1260,NULL),
(113,'servicio','Costo de Instalación',1,6000,6000,0,6000,NULL),

-- COT-114
(114,'producto','Procesador Intel Core i3-N305, Memoria RAM 8 GB, Disco Duro SSD 512 GB, Pantalla IPS FHD de 23.8 pulgadas, Gráficos Intel UHD integrados, Windows 11',1,12600,10512.5,0,12600,NULL),

-- COT-115
(115,'producto','MICROSOFT OFFICE 365 FAMILIA',1,1800,1498.34,0,1800,NULL),

-- COT-116
(116,'producto','Switch 4 puertos PoE 10/100 Mbps Hikvision',1,655,533.3,0,655,NULL),
(116,'producto','Switch Poe de 8 Puertos Dahua',2,1200,958.58,0,2400,NULL),
(116,'servicio','Gastos adicionales de viaje',1,2500,0,0,2500,NULL),
(116,'producto','NVR 32 canales 12Mp Hikvision',1,7400,6361.76,0,7400,NULL),
(116,'producto','UPS 4 Salidas / 500VA/250W CDP Li-504',1,1300,1006.17,0,1300,NULL),
(116,'producto','Disco Duro PURPLE de 6TB',1,4500,3966.41,0,4500,NULL),

-- COT-117
(117,'producto','Punto de acceso Wi-Fi Grandstream',2,1615,1282.07,0,3230,NULL),
(117,'producto','Switch PoE+ Gigabit No Administrable / 5 puertos 10/100/1000 Mbps / 4 puertos PoE+ / hasta 60W',1,750,566.71,0,750,NULL),
(117,'producto','Cable UTP 100% cobre',60,7,4.6,0,420,NULL),
(117,'servicio','Costo de Instalación',1,1600,0,0,1600,NULL),

-- COT-118
(118,'producto','Switch Administrable con 8 puertos Gigabit PoE, 2 Uplinks Gigabit (1 SFP), gestión gratuita desde la nube',1,1700,1270,0,1700,NULL),

-- COT-119
(119,'producto','Kit Videoportero IP 2 Megapixel / Apertura Remota App Hik-Connect / PoE / Exterior IP65 + Antivandalico IK08 / 1 Departamento / Apertura con Tarjeta / Soporta 2 Puertas y hasta 6 Monitores',1,3800,2521,0,3800,NULL),
(119,'producto','Monitor Hibrido IP WiFi Touch Screen 7" para DS-KIS303P / Vídeo en Vivo / PoE / Apertura Remota / Llamada Entre Monitores / Audio de dos vías',1,2800,2078.51,0,2800,NULL),
(119,'servicio','Instalacion y configuracion',1,1500,0,0,1500,NULL),
(119,'producto','Punto de acceso Wi-Fi Grandstream',1,1615,1282.07,0,1615,NULL),

-- COT-120
(120,'producto','Memoria Flash Adata Premier, 64GB Microsdxc Uhs-I Clase 10, Con Adaptador',20,260,123.9,0,5200,NULL),
(120,'producto','Switch 4 puertos PoE 10/100 Mbps Hikvision',1,655,533.3,0,655,NULL),
(120,'producto','Switch Poe de 8 Puertos Dahua',2,1200,958.58,0,2400,NULL),
(120,'producto','UPS 4 Salidas / 500VA/250W CDP Li-504',1,1300,1006.17,0,1300,NULL),
(120,'servicio','Gastos adicionales',1,2500,0,0,2500,NULL),

-- COT-121
(121,'producto','Checador wifi MinMoe WiFi Facial y Tarjetas',5,3500,1458,0,17500,NULL),
(121,'servicio','instalacion y configuracion',1,1500,0,0,1500,NULL),

-- COT-122
(122,'producto','Disco Duro New / Pull 3TB / PC',1,1800,1000,0,1800,NULL),

-- COT-123
(123,'producto','KIT TurboHD 1080p HiLook: DVR 8 canales H.265+ / 4 Cámaras Bala Metálicas / Fuente de Poder / Accesorios de Instalación',1,2500,1682.92,-20,3000,NULL),
(123,'producto','Camara bala 2 Mp Dahua',2,327.58,258.42,-30,851.71,NULL),
(123,'producto','Disco Duro New Pull 1 TB',1,800,450,0,800,NULL),
(123,'servicio','materiales de instalacion',1,300,0,0,300,NULL),
(123,'servicio','Monitor semi nuevo de 20 pulgadas con cable de video VGA',1,600,0,0,600,NULL),

-- COT-124
(124,'producto','DVR 8 canales Hikvision',1,950,624.25,0,950,NULL),
(124,'producto','Cámara bala 2 Mp Dahua Micrófono integrado',4,431.04,361.96,-10,1896.58,NULL),
(124,'producto','Disco Duro New Pull 1 TB',1,800,450,0,800,NULL),
(124,'producto','Transceptores Dahua',4,75,40.47,0,300,NULL),
(124,'producto','Fuente de Alimentación de 4 Salidas Epcom',1,300,196.58,0,300,NULL),

-- COT-125
(125,'producto','Eset Small Office Security 10 licencias',1,3000,2174.24,0,3000,NULL),

-- COT-126
(126,'producto','UPS 4 Salidas / 500VA/250W CDP Li-504',2,1300,1006.17,0,2600,NULL),
(126,'producto','Teléfono IP Grado Operador 2 líneas SIP / PoE / codec Opus / IPV4/IPv6 / gestión en la nube GDMS',2,950,543.91,0,1900,NULL),
(126,'servicio','Instalación de 2 nodos de red con cable Cat 6 incluye conectores',2,1100,0,0,2200,NULL),

-- COT-127
(127,'producto','Camara 4MP Domo Hikvision HiLook',10,1200,700.53,0,12000,NULL),
(127,'producto','Terminal Min Moe PoE & WiFi de Reconocimiento Facial y Huella con Lector Hikvision',3,4500,3055.36,0,13500,NULL),
(127,'producto','Disco duro WD 14 TB SATA',1,12000,10042.63,0,12000,NULL),
(127,'producto','NVR 32 canales 12Mp Hikvision',1,7400,6361.76,0,7400,NULL),
(127,'producto','Gabinete metálico 30 cm x 30 cm x 15 cm / Exterior IP65 / NEMA 4 / Acero calibre 14',5,780,642.16,0,3900,NULL),
(127,'producto','Smart TV 50" 4K QLED Google TV Bluetooth Dolby Wifi',1,6000,4998,0,6000,NULL),
(127,'producto','Soporte de TV Movible para Pantalla 14-60"',1,500,378,0,500,NULL),
(127,'producto','Switch 4 puertos PoE 10/100 Mbps Hikvision',2,730,604.13,0,1460,NULL),
(127,'producto','Chapa magnética 600 lbs con LED Ultra-brillante',3,800,562.69,0,2400,NULL),
(127,'producto','Bobina de cable UTP / 305 metros / 100% Cobre',4,2200,1400,0,8800,NULL),
(127,'producto','UPS 4 Salidas / 500VA/250W CDP Li-504',2,1300,1006.17,0,2600,NULL),
(127,'servicio','Tubería (tubo conduit verde)',1,14000,0,0,14000,NULL),
(127,'servicio','Material para fijar tubo PVC, conexiones de tubo, cajas.',1,2000.03,0,0,2000.03,NULL),
(127,'servicio','Costo de Instalación',1,15000,0,0,15000,NULL),
(127,'producto','Switch Poe de 8 Puertos Dahua',5,1200,958.58,0,6000,NULL),
(127,'producto','Camara Bala IP 4 mp Hikvision HiLook',18,1100,637.72,0,19800,NULL),

-- COT-128
(128,'producto','Barebone ASUS Intel Core i3-1315U DDR4-3200 / NO INCLUYE RAM, SSD, OS',1,8620.99,5364.18,0,8620.99,NULL),

-- COT-129
(129,'servicio','Equipo Lenovo Refurbished 8 GB RAM, Intel Core i5, SSD 120 GB',1,0,0,0,0,NULL),

-- COT-130
(130,'producto','Camara Bala IP 8 MP Hikvision',2,2700,2044.6,0,5400,NULL),
(130,'servicio','Se incluye instalar cable nuevo para adaptar este tipo de camaras al sistema ya existente',1,1500,0,0,1500,NULL),

-- COT-131
(131,'producto','Terminal Min Moe PoE & WiFi de Reconocimiento Facial y Huella con Lector Hikvision',4,4500,3055.36,0,18000,NULL),
(131,'servicio','Tarjetas controladoras para elevadores',4,1100,0,0,4400,NULL),
(131,'producto','[Dual Light] HiLook Domo IP 4 Megapixel / Lente 2.8 mm / 20 mts IR + Luz Blanca / Micrófono / ACUSENSE Lite / PoE / H.265+ / ONVIF',4,1300,814.95,0,5200,NULL),
(131,'servicio','Antenas emisoras y receptoras para enlace en elevador',8,750,0,0,6000,NULL),
(131,'producto','Fuente de Poder de 12 Vcc 1 Amper FCC Dahua',8,125,67.74,0,1000,NULL),
(131,'servicio','Costo de Instalación',1,5000,0,0,5000,NULL),
(131,'producto','Bobina de cable UTP / 305 metros / 100% Cobre',1,2200,1400,0,2200,NULL),
(131,'servicio','Materiales de instalacion incluye tuberia de tubo galvanizado y materiales de fijacion',1,2500,0,0,2500,NULL),

-- COT-132
(132,'producto','Interfón con Accionamiento de Cerradura Intec',2,1500,983,0,3000,NULL),
(132,'servicio','Costo de Instalación colocacion y reparacion de cableado para los interfones en la oficina.',1,2000,0,0,2000,NULL),

-- COT-133
(133,'producto','Punto de acceso Wi-Fi Grandstream',3,1615,1282.07,-5,5087.25,NULL),
(133,'servicio','Instalacion y configuracion',3,1000,0,0,3000,NULL);


-- ── SECUENCIA ──────────────────────────────────────────────────────────────────
-- Ajusta la secuencia para que la siguiente cotización nueva empiece desde 134

SELECT setval(pg_get_serial_sequence('cotizaciones', 'id'), 133);


COMMIT;

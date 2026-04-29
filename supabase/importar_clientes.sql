-- ─── PASO 1: Agregar columnas nuevas a la tabla clientes ────────────────────
-- Ejecutar primero si aún no se han agregado direcciones y tiene_poliza

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS direcciones     JSONB    NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tiene_poliza    BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS regimen_fiscal  VARCHAR(10),
  ADD COLUMN IF NOT EXISTS uso_cfdi        VARCHAR(10),
  ADD COLUMN IF NOT EXISTS descuento       NUMERIC(5,2) NOT NULL DEFAULT 0;

-- ─── PASO 2: Importar clientes ───────────────────────────────────────────────

INSERT INTO clientes (id, nombre, rfc, direcciones, contactos, notas, regimen_fiscal, uso_cfdi, descuento, tiene_poliza, activo) VALUES

(1, 'Gabriel Ezquivel', NULL,
 '[{"etiqueta":"Principal","direccion":"Calle 14, # 240, Col. Campestre Guadalupana, Nezahualcoyotl, Estado de México","contactos":[]}]',
 '[{"nombre":"Gabriel Esquivel","puesto":"","telefono":"","email":"","es_fiscal":false}]',
 NULL, '616', 'P01', -16, false, true),

(2, 'GRUPO CAL [Didara-TI]', NULL,
 '[{"etiqueta":"Principal","direccion":"Vasco de Quiroga 1249, Santa Fe, Álvaro Obregón, 01260 Ciudad de México, CDMX","contactos":[]}]',
 '[{"nombre":"Jafet Duran","puesto":"Finanzas","telefono":"55 7657 4308","email":"gerenciadeoperaciones@grupocal.mx","es_fiscal":false},{"nombre":"Zully Pascacio","puesto":"","telefono":"","email":"administracion@grupocal.com.mx","es_fiscal":false},{"nombre":"Marcelino Freixas","puesto":"","telefono":"+52 5611894323","email":"marcelino@grupocal.mx","es_fiscal":false}]',
 NULL, '601', 'G03', 0, false, true),

(3, 'Cliente de prueba para cotizaciones', NULL,
 '[{"etiqueta":"Principal","direccion":"Calle imaginaria #32, col. Arcoiris 077777. Imaginacion","contactos":[]},{"etiqueta":"Sucursal","direccion":"Locura esquina con esquizofrenia, Col. Demencia, codigo postal 08800. Ciudad trastornos mentales","contactos":[{"nombre":"Alzheimer","puesto":"desorientar","telefono":"44568962","email":"que_paso_ayer@hotmail.com"}]}]',
 '[{"nombre":"Dulce","puesto":"Encargada del arcoiris","telefono":"68456390","email":"arcoiris@gmail.com","es_fiscal":false},{"nombre":"Pesadilla","puesto":"Espantar","telefono":"66613129","email":"buuuu@gmail.com","es_fiscal":false}]',
 NULL, '623', 'D06', 30, false, true),

(4, 'SINOSUPPLY', NULL,
 '[{"etiqueta":"Principal","direccion":"C. Álvaro Obregón 81, Santa Anita, Iztacalco, 08300 Ciudad de México, CDMX","contactos":[]},{"etiqueta":"Sucursal 1","direccion":"C. 5 de Febrero 498, Algarín, Cuauhtémoc, 06880 Ciudad de México, CDMX","contactos":[]},{"etiqueta":"Sucursal 2","direccion":"Pantaco Bodega 58 y 59","contactos":[]},{"etiqueta":"Sucursal 3","direccion":"Av. Julian Treviño Elizondo (carretera huinala) no. 220, del fraccionamiento denominado el milagro, c.P. 66634, Apodaca, Nuevo león, México","contactos":[]}]',
 '[]', NULL, '601', 'G01', 0, false, true),

(5, 'HUGO SALADINO', NULL, '[]', '[]', NULL, '601', 'G01', 0, false, true),
(6, 'CAÑITO', NULL, '[]', '[]', NULL, '601', 'G01', 0, false, true),

(7, 'AG TRANSPORTES [Didara-TI]', NULL,
 '[{"etiqueta":"Principal","direccion":"San Francisco Tetecala, 02730 Ciudad de México, CDMX","contactos":[]}]',
 '[]', NULL, '601', 'G01', 0, false, true),

(8, 'J&T EXPRESS [Didara-TI]', NULL,
 '[{"etiqueta":"Principal","direccion":"Av. de los Insurgentes Sur No. 859, Piso 12, Nápoles, Benito Juárez, 03840 Ciudad de México, México.","contactos":[{"nombre":"Victor Ramos Badillo","puesto":"","telefono":"","email":"victor.ramosb@jtexpress.mx"}]}]',
 '[{"nombre":"Victor Ramos Badillo","puesto":"","telefono":"","email":"victor.ramosb@jtexpress.mx","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(9, 'IBECOMEX [Didara-TI]', NULL,
 '[{"etiqueta":"Principal","direccion":"6500","contactos":[]}]',
 '[{"nombre":"","puesto":"","telefono":"","email":"avazquezv@ibecomex.mx","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(10, 'AZUL CONDESA [Didara-TI]', NULL,
 '[{"etiqueta":"Principal","direccion":"Av. Nuevo León 68, Hipódromo, Cuauhtémoc, 06100 Ciudad de México, CDMX","contactos":[{"nombre":"Diego","puesto":"Administrador","telefono":"55 8046 0440","email":"cuentascondesa@gmail.com"},{"nombre":"Rosalba","puesto":"Encargada de Compras","telefono":"5578785221","email":"rosalba.azulrestaurantes@gmail.com"}]}]',
 '[{"nombre":"Diego","puesto":"Administrador","telefono":"55 8046 0440","email":"cuentascondesa@gmail.com","es_fiscal":false},{"nombre":"Rosalba","puesto":"Encargada de Compras","telefono":"5578785221","email":"rosalba.azulrestaurantes@gmail.com","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(11, 'TECNOLOGÍA E INGENIERÍA LUQROSS [Didara-TI]', NULL,
 '[{"etiqueta":"Principal","direccion":"Antigua Calz. de Guadalupe 105, San Marcos, Azcapotzalco, 02020 Ciudad de México, CDMX","contactos":[{"nombre":"ARISTEO VIVARA","puesto":"Contabilidad","telefono":"5531472058","email":"facturacion@luqross.com"},{"nombre":"Denisse Marin","puesto":"Recepción","telefono":"5519925117","email":"recepcion@luqross.com"}]}]',
 '[{"nombre":"ARISTEO VIVARA","puesto":"Contabilidad","telefono":"5531472058","email":"facturacion@luqross.com","es_fiscal":false},{"nombre":"Denisse Marin","puesto":"Recepción","telefono":"5519925117","email":"recepcion@luqross.com","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(12, 'GRUPO DURVAL OPERADORA DE RESTAURANTES Y BARES', NULL,
 '[{"etiqueta":"Principal","direccion":"CP 06700","contactos":[]}]',
 '[]', NULL, '601', 'G01', 0, false, true),

(13, 'EMG ENERGIAS SUSTENTABLES', NULL,
 '[{"etiqueta":"Principal","direccion":"Av. P.º de la Reforma 243, Col. Renacimiento, Cuauhtémoc, 06500 Ciudad de México, CDMX","contactos":[{"nombre":"","puesto":"","telefono":"","email":"jmlanusse@ibecomex.mx"}]}]',
 '[{"nombre":"","puesto":"","telefono":"","email":"jmlanusse@ibecomex.mx","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(14, 'ZIEVEN MEXICANA', NULL,
 '[{"etiqueta":"Principal","direccion":"CP 09360","contactos":[]},{"etiqueta":"Sucursal 1","direccion":"C. Gavilán 565, San Miguel, Iztapalapa, 09300 Ciudad de México, CDMX","contactos":[]}]',
 '[{"nombre":"Jesus","puesto":"Administrador","telefono":"5616786280","email":"","es_fiscal":false},{"nombre":"Adelina","puesto":"Aux admon","telefono":"5636123077","email":"","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(15, 'JUAN JOSÉ FLORES ROCHA', 'FORJ850519788',
 '[{"etiqueta":"Principal","direccion":"CP 07230","contactos":[{"nombre":"JUAN JOSÉ FLORES ROCHA","puesto":"","telefono":"","email":"facturacion@neografico.com.mx"}]}]',
 '[{"nombre":"JUAN JOSÉ FLORES ROCHA","puesto":"","telefono":"","email":"facturacion@neografico.com.mx","es_fiscal":true}]',
 NULL, '626', 'G01', 0, false, true),

(16, 'LIFE SHOP', 'LSH200918ET8',
 '[{"etiqueta":"Principal","direccion":"Camelia 232, Buenavista, Cuauhtémoc, 06350 Ciudad de México, CDMX","contactos":[]}]',
 '[]', NULL, '601', 'G01', 0, false, true),

(17, 'CAA BRAND MANAGEMENT 1', 'CBM2303307X3',
 '[{"etiqueta":"Principal","direccion":"CP 01330","contactos":[{"nombre":"DIANA HERNÁNDEZ","puesto":"","telefono":"","email":"diana.hernandez@caa.com"},{"nombre":"Eduardo Ortega","puesto":"","telefono":"","email":"eduardo.ortega@caa.com"}]}]',
 '[{"nombre":"DIANA HERNÁNDEZ","puesto":"","telefono":"","email":"diana.hernandez@caa.com","es_fiscal":true},{"nombre":"Eduardo Ortega","puesto":"","telefono":"","email":"eduardo.ortega@caa.com","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(18, 'IB ECOMERCE', NULL,
 '[{"etiqueta":"Principal","direccion":"Av. P.º de la Reforma 243, Col. Renacimiento, Cuauhtémoc, 06500 Ciudad de México, CDMX","contactos":[]}]',
 '[]', NULL, '626', 'G01', 0, false, true),

(19, 'J&T CONEJO CORRIENDO', 'CCO210827216',
 '[{"etiqueta":"Principal","direccion":"CP 03810","contactos":[{"nombre":"","puesto":"","telefono":"","email":"andrea.lerma@jtexpress.mx"}]}]',
 '[{"nombre":"","puesto":"","telefono":"","email":"andrea.lerma@jtexpress.mx","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(20, 'CONSORCIO CONSULTOR LAR', 'CCL970702RQ6',
 '[{"etiqueta":"Principal","direccion":"Antigua Calz. de Guadalupe 105, San Marcos, Azcapotzalco, 02020 Ciudad de México, CDMX","contactos":[{"nombre":"ARISTEO VIVARA","puesto":"","telefono":"","email":"facturacion@luqross.com"}]}]',
 '[{"nombre":"ARISTEO VIVARA","puesto":"","telefono":"","email":"facturacion@luqross.com","es_fiscal":true}]',
 NULL, '601', 'G01', 0, false, true),

(21, 'MB COM. PUBLICIDAD', 'MCP050216NG1',
 '[{"etiqueta":"Principal","direccion":"TIERRA BLANCA, MEXICO, DF 02130, MX","contactos":[]}]',
 '[]', NULL, '601', 'G01', 0, false, true),

(22, 'INGENIERÍA Y SERVICIO VIOR', 'ISV190305ET5',
 '[{"etiqueta":"Principal","direccion":"Chicoloapan de Juárez, Estado de México, CP 56390.","contactos":[{"nombre":"YAREL HERRERA","puesto":"","telefono":"","email":"aherrera@vior.mx"}]}]',
 '[{"nombre":"YAREL HERRERA","puesto":"","telefono":"","email":"aherrera@vior.mx","es_fiscal":true}]',
 NULL, '626', 'G01', 0, false, true),

(23, 'OPERADORA SARE', 'OSA150923DU4',
 '[{"etiqueta":"Principal","direccion":"Vasco de Quiroga 1249, Santa Fe, Álvaro Obregón, 01260 Ciudad de México, CDMX.","contactos":[{"nombre":"","puesto":"","telefono":"","email":"administracion@grupocal.mx"},{"nombre":"","puesto":"","telefono":"","email":"gerenciadeoperaciones@grupocal.mx"},{"nombre":"","puesto":"","telefono":"","email":"marcelino@grupocal.mx"}]}]',
 '[{"nombre":"","puesto":"","telefono":"","email":"administracion@grupocal.mx","es_fiscal":true},{"nombre":"","puesto":"","telefono":"","email":"gerenciadeoperaciones@grupocal.mx","es_fiscal":false},{"nombre":"","puesto":"","telefono":"","email":"marcelino@grupocal.mx","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(24, 'INGENIERÍA E INDUSTRIA LOANCA', 'IIL180803NL4',
 '[{"etiqueta":"Principal","direccion":"CP 54080","contactos":[]}]',
 '[]', NULL, '626', 'G01', 0, false, true),

(25, 'CONMERCIALIZADORA DE ALIMENTOS CAL', 'CAC1703177P1',
 '[{"etiqueta":"Principal","direccion":"Vasco de Quiroga 1249, Santa Fe, Álvaro Obregón, 01260 Ciudad de México, CDMX","contactos":[{"nombre":"","puesto":"","telefono":"","email":"administracion@grupocal.mx"},{"nombre":"","puesto":"","telefono":"","email":"gerenciadeoperaciones@grupocal.mx"},{"nombre":"","puesto":"","telefono":"","email":"marcelino@grupocal.mx"}]}]',
 '[{"nombre":"","puesto":"","telefono":"","email":"administracion@grupocal.mx","es_fiscal":true},{"nombre":"","puesto":"","telefono":"","email":"gerenciadeoperaciones@grupocal.mx","es_fiscal":false},{"nombre":"","puesto":"","telefono":"","email":"marcelino@grupocal.mx","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(26, 'JUAN ANDRES CAMACHO FIGUEROA', 'CAFJ980812V45',
 '[{"etiqueta":"Principal","direccion":"CP 09820","contactos":[]}]',
 '[]', NULL, '612', 'G01', 0, false, true),

(27, 'DESCUBRIENDO Y SIRVIENDO CON INNOVACION', 'DSI1907038F3',
 '[{"etiqueta":"Principal","direccion":"CP 07300","contactos":[]}]',
 '[]', NULL, '626', 'G01', 0, false, true),

(28, 'LANCERO', 'LAN2205305V1',
 '[{"etiqueta":"Principal","direccion":"Alba 1565, Lomas de San Pedrito, 45580 San Pedro Tlaquepaque, Jal.","contactos":[{"nombre":"Rosalba","puesto":"","telefono":"+52 1 33 2162 0434","email":"sinosupply115@gmail.com"}]},{"etiqueta":"Sucursal Guadalajara","direccion":"C. José María Morelos 713, Zona Centro, 44100 Guadalajara, Jal.","contactos":[]},{"etiqueta":"Sucursal Hermosillo","direccion":"Blvd. Agustín G. del Campo 93-C, El Llano, Quinta Emilia, 83210 Hermosillo, Son.","contactos":[]},{"etiqueta":"Sucursal Culiacán","direccion":"Blvd. San Angel 3670-B, Mercado de Abastos, San Benito, 80243 Culiacán Rosales, Sin.","contactos":[]}]',
 '[{"nombre":"Rosalba","puesto":"","telefono":"+52 1 33 2162 0434","email":"sinosupply115@gmail.com","es_fiscal":true}]',
 NULL, '601', 'G01', 0, false, true),

(29, 'LOLE STUDIO DISEÑO', 'LSD130123PK',
 '[{"etiqueta":"Principal","direccion":"Playa Erizo 142, Santiago Sur, Iztacalco, 08800 Ciudad de México, CDMX","contactos":[]}]',
 '[]', NULL, '626', 'G01', 0, false, true),

(30, 'PRODUCTOS Y SERVICIOS TECCOMAD', 'PST101217JV1',
 '[{"etiqueta":"Principal","direccion":"CP 04930","contactos":[{"nombre":"","puesto":"","telefono":"","email":"crisval.teccomand@gmail.com"}]}]',
 '[{"nombre":"","puesto":"","telefono":"","email":"crisval.teccomand@gmail.com","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(31, 'CONTROLADORA DE COSTOS Y GASTOS OPERATIVOS', 'CCG081124DY4',
 '[{"etiqueta":"Principal","direccion":"CP 01220","contactos":[{"nombre":"","puesto":"","telefono":"","email":"operacion@grupocal.mx"},{"nombre":"","puesto":"","telefono":"","email":"ayxoperaciones@grupocal.mx"}]}]',
 '[{"nombre":"","puesto":"","telefono":"","email":"operacion@grupocal.mx","es_fiscal":true},{"nombre":"","puesto":"","telefono":"","email":"ayxoperaciones@grupocal.mx","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(32, 'IMPRESOS TECNOLOGICOS Y EMPAQUES', 'ITE2008073C4',
 '[{"etiqueta":"Principal","direccion":"CP 06880","contactos":[{"nombre":"","puesto":"","telefono":"","email":"administracion@tecprint.com.mx"}]}]',
 '[{"nombre":"","puesto":"","telefono":"","email":"administracion@tecprint.com.mx","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(33, 'SOPA DE TORTILLA RESTAURANTE (LA CONDESA)', 'STR101026HI8',
 '[{"etiqueta":"Principal","direccion":"CP 06100","contactos":[{"nombre":"DIEGO GARCÍA","puesto":"","telefono":"","email":"cuentascondesa@gmail.com"},{"nombre":"","puesto":"","telefono":"","email":"rosalba.azulrestaurantes@gmail.com"}]}]',
 '[{"nombre":"DIEGO GARCÍA","puesto":"","telefono":"","email":"cuentascondesa@gmail.com","es_fiscal":true},{"nombre":"","puesto":"","telefono":"","email":"rosalba.azulrestaurantes@gmail.com","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(34, 'LA VACA Y EL MAGO (HISTORICO)', 'VMA100823IK6',
 '[{"etiqueta":"Principal","direccion":"Isabel La Católica 30, Centro Histórico de la Cdad. de México, Centro, Cuauhtémoc, 06000 Ciudad de México, CDMX, México","contactos":[{"nombre":"PATRICIA GUZMÁN","puesto":"","telefono":"","email":"cuentascondesa@gmail.com"},{"nombre":"","puesto":"","telefono":"","email":"rosalba.azulrestaurantes@gmail.com"}]}]',
 '[{"nombre":"PATRICIA GUZMÁN","puesto":"","telefono":"","email":"cuentascondesa@gmail.com","es_fiscal":true},{"nombre":"","puesto":"","telefono":"","email":"rosalba.azulrestaurantes@gmail.com","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(35, 'AZUL TRADICIONAL (AZULISIMO)', 'ATR180911RBA',
 '[{"etiqueta":"Principal","direccion":"Venustiano Carranza #57, Centro Histórico, CP 06000","contactos":[{"nombre":"Rosalba","puesto":"Encargada de Compras","telefono":"","email":"rosalba.azulrestaurantes@gmail.com"}]}]',
 '[{"nombre":"Rosalba","puesto":"Encargada de Compras","telefono":"","email":"rosalba.azulrestaurantes@gmail.com","es_fiscal":true}]',
 NULL, '601', 'G01', 0, false, true),

(36, 'Condominio Carlos B. Zetina 30', NULL,
 '[{"etiqueta":"Principal","direccion":"Carlos B. Zetina 30, Escandón I Secc, Miguel Hidalgo, 06170 Ciudad de México, CDMX","contactos":[{"nombre":"Alejandra Martinez","puesto":"Administradora de Condominio","telefono":"55 3906 2812","email":""}]}]',
 '[{"nombre":"Alejandra Martinez","puesto":"Administradora de Condominio","telefono":"55 3906 2812","email":"","es_fiscal":false}]',
 NULL, '601', 'G03', -16, false, true),

(37, 'EL FAUNO GOLOSO (RESTAURANTE MEROTORO)', 'FFO090803B96',
 '[{"etiqueta":"Principal","direccion":"ÁMSTERDAM #204, ALCALDÍA CUAUHTÉMOC, COLONIA HIPÓDROMO, C.P. 06100, CIUDAD DE MÉXICO.","contactos":[{"nombre":"Ulises Flores","puesto":"Capitán","telefono":"5567538795","email":"facturasmerotoro@gmail.com"},{"nombre":"Ulises Flores","puesto":"Capitán","telefono":"","email":"ulises@merotoro.mx"}]}]',
 '[{"nombre":"Ulises Flores","puesto":"Capitán","telefono":"5567538795","email":"facturasmerotoro@gmail.com","es_fiscal":true},{"nombre":"Ulises Flores","puesto":"Capitán","telefono":"","email":"ulises@merotoro.mx","es_fiscal":false}]',
 NULL, '601', 'G03', 0, false, true),

(38, 'TRANSPORTES RAFAGAN', NULL, '[]',
 '[{"nombre":"Rafael Hueicochea","puesto":"Jefe","telefono":"","email":"","es_fiscal":false}]',
 NULL, '601', 'G03', -2, false, true),

(39, 'CLIENTE RESIDENCIAL', NULL, '[]', '[]', NULL, '616', 'G01', 0, false, true),

(40, 'Grupo SUCA Almonte', NULL,
 '[{"etiqueta":"Principal","direccion":"Canela 220, Granjas México, Iztacalco, 08400 Ciudad de México, CDMX","contactos":[{"nombre":"Oscar","puesto":"Director","telefono":"","email":""},{"nombre":"Carlos Lua","puesto":"Encargado de Sistemas","telefono":"","email":""}]}]',
 '[{"nombre":"Oscar","puesto":"Director","telefono":"","email":"","es_fiscal":false},{"nombre":"Carlos Lua","puesto":"Encargado de Sistemas","telefono":"","email":"","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(41, 'Moctezuma', NULL, '[]', '[]', NULL, '616', 'G01', 0, false, true),

(42, 'Transportes Mooba', NULL,
 '[{"etiqueta":"Principal","direccion":"Bodega C16 Central de Carga Oriente, CDMX","contactos":[{"nombre":"Erick Bautista Avila","puesto":"Jefe","telefono":"5532471490","email":"transportesmooba@gmail.com"}]}]',
 '[{"nombre":"Erick Bautista Avila","puesto":"Jefe","telefono":"5532471490","email":"transportesmooba@gmail.com","es_fiscal":false}]',
 NULL, '601', 'G03', -2, false, true),

(43, 'Enlaces Comerciales', NULL,
 '[{"etiqueta":"Principal","direccion":"Bodega D4 Central de carga oriente, CDMX","contactos":[{"nombre":"Miguel Angel Castro Duran","puesto":"Jefe","telefono":"5640453452","email":"enlaces100@gmail.com"}]}]',
 '[{"nombre":"Miguel Angel Castro Duran","puesto":"Jefe","telefono":"5640453452","email":"enlaces100@gmail.com","es_fiscal":false}]',
 NULL, '601', 'G03', -2, false, true),

(45, 'Siemens Energy', NULL,
 '[{"etiqueta":"Principal","direccion":"Torre Antara II Blvd. Miguel de Cervantes Saavedra 224 piso 8 Col. Granada C.P. 11520 Miguel Hidalgo. Ciudad de México México","contactos":[]}]',
 '[]', NULL, '601', 'G01', 0, false, true),

(46, 'Metales Elias Esquivel', NULL, '[]', '[]', NULL, '601', 'G01', 0, false, true),

(47, 'AZUL HISTORICO', NULL,
 '[{"etiqueta":"Principal","direccion":"Isabel la Católica #30, Centro Histórico CP 06000.","contactos":[{"nombre":"","puesto":"","telefono":"","email":"cuentashistorico@gmail.com"},{"nombre":"Rosalba","puesto":"Encargada de Compras","telefono":"","email":"rosalba.azulrestaurantes@gmail.com"}]}]',
 '[{"nombre":"","puesto":"","telefono":"","email":"cuentashistorico@gmail.com","es_fiscal":false},{"nombre":"Rosalba","puesto":"Encargada de Compras","telefono":"","email":"rosalba.azulrestaurantes@gmail.com","es_fiscal":false}]',
 NULL, '601', 'G01', 0, false, true),

(48, 'Condesa Trees', NULL,
 '[{"etiqueta":"Principal","direccion":"Carlos B. Zetina 30, Hipódromo Condesa, Cuauhtémoc, C.P. 06170 Ciudad de México, CDMX","contactos":[{"nombre":"Alejandra Martinez","puesto":"Administradora","telefono":"5539062812","email":"mumumart@yahoo.com.mx"}]}]',
 '[{"nombre":"Alejandra Martinez","puesto":"Administradora","telefono":"5539062812","email":"mumumart@yahoo.com.mx","es_fiscal":false}]',
 NULL, NULL, NULL, 0, false, true),

(49, 'Sino Ocean', NULL,
 '[{"etiqueta":"Principal","direccion":"C. 20 Sur 1302, Azcarate, 72501 Heroica Puebla de Zaragoza, Pue","contactos":[{"nombre":"Eduardo Vazquez Pillado","puesto":"Gerente","telefono":"55 6105 2705","email":"sinosupply13@gmail.com"}]}]',
 '[{"nombre":"Eduardo Vazquez Pillado","puesto":"Gerente","telefono":"55 6105 2705","email":"sinosupply13@gmail.com","es_fiscal":false}]',
 NULL, NULL, NULL, 0, false, true)

ON CONFLICT (id) DO UPDATE SET
  nombre          = EXCLUDED.nombre,
  rfc             = EXCLUDED.rfc,
  direcciones     = EXCLUDED.direcciones,
  contactos       = EXCLUDED.contactos,
  notas           = EXCLUDED.notas,
  regimen_fiscal  = EXCLUDED.regimen_fiscal,
  uso_cfdi        = EXCLUDED.uso_cfdi,
  descuento       = EXCLUDED.descuento,
  tiene_poliza    = EXCLUDED.tiene_poliza,
  activo          = EXCLUDED.activo;

-- ─── PASO 3: Resetear secuencia ──────────────────────────────────────────────
SELECT setval('clientes_id_seq', (SELECT MAX(id) FROM clientes));

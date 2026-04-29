# Contexto de sesión — Didara ERP

## Último punto de trabajo
- **Módulo:** Cotizaciones
- **Tarea pendiente 1:** Importar CSV de datos a Supabase (pendiente de que el usuario comparta el archivo)
- **Tarea pendiente 2:** Agregar 2 botones de acción faltantes en la tabla de cotizaciones (usuario recuerda que faltaban 2, definir cuáles)

## Botones actuales en tabla de cotizaciones
Archivo: `src/app/(dashboard)/cotizaciones/CotizacionesClient.tsx` línea 200-226

| Botón | Ícono | Visible para |
|-------|-------|-------------|
| Descargar PDF | Download | Todos |
| Editar | Pencil | nivel <= 2 |
| Eliminar | Trash2 | nivel <= 1 (admin) |

## Stack
- Next.js 15 + React 19 + TypeScript + Supabase (PostgreSQL) + Tailwind CSS
- PDF: docxtemplater + LibreOffice CLI
- Email: Nodemailer (SMTP: mail.didara-ti.com)

## APIs relacionadas disponibles
- `/api/cotizaciones` — CRUD cotizaciones
- `/api/pdf/cotizacion/[id]` — Generar PDF
- `/api/correo` — Envío de correo (ya existe, puede usarse para enviar cotización)
- `/api/cotizaciones/[id]` — PATCH estado, DELETE

## Páginas especiales
- `src/app/firma-cliente/page.tsx` — Página de firma digital del cliente

## Base de datos (Supabase)
- Tabla `cotizaciones`: folio, cliente_id, estado, aplica_iva, iva_porcentaje, subtotal, iva_monto, total, ganancia_total, quien_es_el_cliente, elaborado_por, direccion_entrega, contactos_cotizacion, notas
- Tabla `cotizacion_items`: cotizacion_id, tipo (producto/servicio/equipo_recuperado), descripcion, cantidad, precio_unitario, precio_compra, cantidad_recuperada, descuento, subtotal, producto_id

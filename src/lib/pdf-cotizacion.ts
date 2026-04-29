import puppeteer from 'puppeteer-core'

export interface ItemPDF {
  descripcion: string
  cantidad: number
  precio_unitario: string
  descuento: number
  subtotal: string
  imagen_url: string | null
}

export interface EmpresaPDF {
  nombre: string
  direccion: string
  telefono: string
  email: string
  web: string
}

export interface DatosCotizacionPDF {
  folio: string
  fecha: string
  vigencia?: string
  cliente_nombre: string
  aplica_iva: boolean
  iva_porcentaje: string
  subtotal: string
  iva_monto: string
  total: string
  notas?: string
  condiciones?: string
  elaborado_por?: string
  empresa?: EmpresaPDF
  items: ItemPDF[]
}

// ─── HTML Template ────────────────────────────────────────────

const LOGO_URL =
  process.env.LOGO_URL ??
  'https://zoknsjiaizwxehznpgnk.supabase.co/storage/v1/object/public/logo/Imagen1.png'

const DEFAULT_EMPRESA: EmpresaPDF = {
  nombre:    'DIDARA TI',
  direccion: 'Pipila 7, San Juan Ixhuatepec, 54180 Tlalnepantla, Méx.',
  telefono:  '5566895603',
  email:     'direccion@didara-ti.com',
  web:       'www.didara-ti.com',
}

function htmlCotizacion(d: DatosCotizacionPDF): string {
  const logoSrc = LOGO_URL
  const emp = d.empresa ?? DEFAULT_EMPRESA

  const filas = d.items.map((item) => `
    <tr>
      <td class="img-cell">
        ${item.imagen_url
          ? `<img src="${item.imagen_url}" class="product-img" />`
          : `<div class="no-img">Sin img.</div>`}
      </td>
      <td class="center">${item.cantidad}</td>
      <td>${item.descripcion}</td>
      <td class="right">${item.precio_unitario}</td>
      <td class="right">${item.subtotal}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #333; }

  /* ── Encabezado empresa ── */
  .header {
    display: flex; align-items: flex-start;
    padding: 14px 22px 10px;
  }
  .company-center { flex: 1; text-align: center; }
  .company-name { font-size: 13px; font-weight: bold; color: #1a7a6e; margin-bottom: 3px; }
  .company-info { font-size: 9px; color: #555; line-height: 1.7; }
  .logo-img { width: 80px; height: auto; flex-shrink: 0; }

  /* ── Marca de agua ── */
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 680px; height: 680px;
    opacity: 0.12; pointer-events: none;
    background: url('${logoSrc}') no-repeat center/contain;
  }

  /* ── Folio + datos ── */
  .body { padding: 4px 22px 20px; }
  .folio { text-align: right; color: #c0392b; font-size: 15px; font-weight: bold; margin-bottom: 10px; }
  .meta { margin-bottom: 14px; line-height: 2; }
  .meta .label { font-weight: bold; }
  .cliente-nombre { text-decoration: underline; font-weight: bold; }

  /* ── Tabla ítems ── */
  .section-title {
    background: #1a7a6e; color: white; text-align: center;
    font-weight: bold; padding: 7px; font-size: 11px; margin-bottom: 0;
  }
  table { width: 100%; border-collapse: collapse; }
  thead th {
    background: #f0f0f0; border: 1px solid #ccc;
    padding: 5px 8px; font-size: 10px; text-align: center;
  }
  tbody td { border: 1px solid #ddd; padding: 5px 8px; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #fafafa; }
  .img-cell { text-align: center; width: 75px; }
  .product-img { width: 65px; height: 65px; object-fit: cover; border-radius: 3px; }
  .no-img {
    width: 65px; height: 65px; background: #eee; border-radius: 3px;
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; color: #999; text-align: center;
  }
  .center { text-align: center; }
  .right  { text-align: right; }

  /* ── Totales ── */
  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
  .totals { width: 240px; border-collapse: collapse; }
  .totals td { padding: 3px 8px; border: none; font-size: 11px; }
  .totals .total-row td { border-top: 1px solid #aaa; font-weight: bold; font-size: 13px; padding-top: 6px; }

  /* ── Notas / Pago / Firma ── */
  .notes { margin-top: 16px; }
  .notes .title { font-weight: bold; margin-bottom: 3px; }
  .notes .body-text { font-style: italic; color: #444; line-height: 1.5; }
  .gracias { margin-top: 12px; font-style: italic; color: #555; }
  .pago { margin-top: 14px; line-height: 1.8; }
  .pago .title { font-weight: bold; }
  .firma { margin-top: 28px; text-align: right; }
  .firma-line { display: inline-block; border-top: 1px solid #333; width: 220px; padding-top: 4px; font-size: 10px; color: #555; }
  .elaborado { margin-top: 6px; font-size: 9px; color: #888; }
</style>
</head>
<body>
${logoSrc ? `<div class="watermark"></div>` : ''}

<!-- Encabezado empresa -->
<div class="header">
  <div class="company-center">
    <div class="company-name">${emp.nombre}</div>
    <div class="company-info">
      ${emp.direccion}<br>
      Tel: ${emp.telefono} | Email: ${emp.email} | Web: ${emp.web}
    </div>
  </div>
  ${logoSrc ? `<img src="${logoSrc}" class="logo-img" alt="${emp.nombre}" />` : `<div style="font-weight:bold;color:#1a7a6e">${emp.nombre}</div>`}
</div>

<div class="body">

  <!-- Folio -->
  <div class="folio">${d.folio}</div>

  <!-- Datos generales -->
  <div class="meta">
    <div><span class="label">Fecha:</span> ${d.fecha}${d.vigencia ? `&nbsp;&nbsp;&nbsp;<span class="label">Vigencia:</span> ${d.vigencia}` : ''}</div>
    <div><span class="label">Cliente:</span> <span class="cliente-nombre">${d.cliente_nombre}</span></div>
  </div>

  <!-- Tabla de productos/servicios -->
  <div class="section-title">Detalle de Productos/Servicios</div>
  <table>
    <thead>
      <tr>
        <th>Imagen</th>
        <th>Cantidad</th>
        <th>Descripción</th>
        <th>Precio Unitario</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${filas}
    </tbody>
  </table>

  <!-- Totales -->
  <div class="totals-wrap">
    <table class="totals">
      <tr>
        <td>Subtotal:</td>
        <td class="right">${d.subtotal}</td>
      </tr>
      <tr>
        <td>IVA (${d.iva_porcentaje}%):</td>
        <td class="right">${d.iva_monto}</td>
      </tr>
      <tr class="total-row">
        <td>TOTAL:</td>
        <td class="right">${d.total}</td>
      </tr>
    </table>
  </div>

  <!-- Notas -->
  ${d.notas || d.condiciones ? `
  <div class="notes">
    <div class="title">Notas y Condiciones Comerciales:</div>
    <div class="body-text">${[d.notas, d.condiciones].filter(Boolean).join('<br>')}</div>
  </div>` : ''}

  <div class="gracias">Gracias por su preferencia.</div>

  <!-- Método de pago -->
  <div class="pago">
    <div class="title">Método de pago:</div>
    Nombre del banco: BBVA<br>
    Número de cuenta: 0480939986<br>
    CLABE interbancaria: 012180004809399868<br>
    Nombre del titular de la cuenta: Pablo Alexander Ramírez Herrera
  </div>

  <!-- Firma -->
  <div class="firma">
    <div class="firma-line">Firma y nombre de quien autoriza</div>
    ${d.elaborado_por ? `<div class="elaborado">Elaborado por: ${d.elaborado_por}</div>` : ''}
  </div>

</div>
</body>
</html>`
}

// ─── Puppeteer: detecta entorno automáticamente ───────────────

async function abrirBrowser() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 900 },
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  const executablePath =
    process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/google-chrome'

  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })
}

// ─── Función principal ────────────────────────────────────────

export async function generarPDFCotizacion(datos: DatosCotizacionPDF): Promise<Buffer> {
  const html = htmlCotizacion(datos)
  const browser = await abrirBrowser()

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const footerTemplate = `
      <div style="width:100%;font-family:Arial,sans-serif;font-size:8px;color:#999;
        display:flex;justify-content:space-between;align-items:center;
        padding:4px 22px;border-top:1px solid #e5e7eb;box-sizing:border-box;">
        <span style="color:#1a7a6e;font-weight:bold;letter-spacing:0.5px;">${datos.folio}</span>
        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>`
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
      margin: { top: '10mm', right: '12mm', bottom: '16mm', left: '12mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

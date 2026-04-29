import puppeteer from 'puppeteer-core'

export interface ItemPDFReporte {
  descripcion: string
  cantidad: number
  precio_unitario: string
  subtotal: string
}

export interface EvidenciaPDF {
  tipo: string
  descripcion?: string
  urls: string[]
}

export interface EmpresaPDFReporte {
  nombre: string
  direccion: string
  telefono: string
  email: string
  web: string
}

export interface DatosReportePDF {
  folio: string
  fecha_ingreso: string
  fecha_entrega?: string
  cliente_nombre: string
  direccion_servicio?: string
  tecnico_nombre: string
  equipo: string
  marca?: string
  modelo?: string
  serie?: string
  tipo_servicio: string[]
  falla_reportada: string
  diagnostico?: string
  trabajos_realizados: string[]
  observaciones?: string
  evidencias?: EvidenciaPDF[]
  items: ItemPDFReporte[]
  subtotal: string
  total: string
  firma_cliente?: string
  firma_fecha?: string
  empresa?: EmpresaPDFReporte
  estado: string
}

// ─── Defaults ─────────────────────────────────────────────────

const LOGO_URL =
  process.env.LOGO_URL ??
  'https://zoknsjiaizwxehznpgnk.supabase.co/storage/v1/object/public/logo/Imagen1.png'

const DEFAULT_EMPRESA: EmpresaPDFReporte = {
  nombre:    'DIDARA TI',
  direccion: 'Pipila 7, San Juan Ixhuatepec, 54180 Tlalnepantla, Méx.',
  telefono:  '5566895603',
  email:     'direccion@didara-ti.com',
  web:       'www.didara-ti.com',
}

// ─── HTML Template ────────────────────────────────────────────

function htmlReporte(d: DatosReportePDF): string {
  const emp = d.empresa ?? DEFAULT_EMPRESA

  const tipoServStr = d.tipo_servicio.length > 0 ? d.tipo_servicio.join(' · ') : '—'
  void tipoServStr

  const trabajosHtml = d.trabajos_realizados.length > 0
    ? d.trabajos_realizados.map((t) => `<li>${t}</li>`).join('')
    : '<li style="color:#999">No se registraron trabajos.</li>'

  // Materiales: siempre visible, con mensaje cuando está vacío
  const filasItems = d.items.map((item) => `
    <tr>
      <td class="center">${item.cantidad}</td>
      <td>${item.descripcion}</td>
      <td class="right">${item.subtotal}</td>
    </tr>`).join('')

  const materialesHtml = d.items.length > 0
    ? `<table>
        <thead>
          <tr>
            <th>Cantidad</th>
            <th style="text-align:left">Descripción</th>
            <th>Costo</th>
          </tr>
        </thead>
        <tbody>${filasItems}</tbody>
      </table>
      <div class="totals-wrap">
        <table class="totals">
          <tr class="total-row"><td>TOTAL:</td><td class="right">${d.total}</td></tr>
        </table>
      </div>`
    : '<p style="color:#aaa;font-size:10px;padding:6px 4px;font-style:italic">No se utilizaron materiales.</p>'

  // Evidencias fotográficas
  const evidenciasHtml = (() => {
    if (!d.evidencias?.length) return ''
    const grupos = d.evidencias.filter((ev) => ev.urls && ev.urls.length > 0)
    if (!grupos.length) return ''
    return grupos.map((ev) => {
      const label = ev.tipo === 'antes' ? 'Antes' : ev.tipo === 'despues' ? 'Después' : ev.tipo
      const titulo = ev.descripcion ? `${label}: ${ev.descripcion}` : label
      const imgs = ev.urls
        .map((url) => `<img src="${url}" class="ev-img" alt="${label}" onerror="this.style.display='none'" />`)
        .join('')
      return `<div class="ev-group">
        <div class="ev-label">Evidencia - ${titulo}</div>
        <div class="ev-imgs">${imgs}</div>
      </div>`
    }).join('')
  })()

  const firmaHtml = d.firma_cliente
    ? `<img src="${d.firma_cliente}" style="height:70px;max-width:200px;object-fit:contain;" />`
    : `<div class="firma-linea"></div>`

  const firmaFechaStr = d.firma_fecha
    ? new Date(d.firma_fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10.5px; color: #333; }

  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 680px; height: 680px;
    opacity: 0.14; pointer-events: none;
    background: url('${LOGO_URL}') no-repeat center/contain;
  }

  /* ── Header empresa ── */
  .header { display: flex; align-items: flex-start; padding: 14px 22px 10px; }
  .company-center { flex: 1; text-align: center; }
  .company-name { font-size: 13px; font-weight: bold; color: #1a7a6e; margin-bottom: 3px; }
  .company-info { font-size: 9px; color: #555; line-height: 1.7; }
  .logo-img { width: 80px; height: auto; flex-shrink: 0; }

  /* ── Body ── */
  .body { padding: 2px 22px 20px; }

  /* ── Folio ── */
  .folio-row { margin-bottom: 8px; }
  .folio { color: #c0392b; font-size: 15px; font-weight: bold; }

  /* ── Secciones ── */
  .section { margin-bottom: 10px; }
  .section-title {
    background: #1a7a6e; color: white; font-weight: bold;
    padding: 5px 10px; font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.5px; margin-bottom: 6px;
  }

  /* ── Grids de datos ── */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 20px; padding: 0 4px; }
  .info-grid .full { grid-column: 1 / -1; }
  .info-row { display: flex; gap: 4px; line-height: 1.8; }
  .info-label { font-weight: bold; white-space: nowrap; color: #555; }
  .info-val { color: #222; }

  /* ── Tipo de servicio tags ── */
  .tipo-tags { padding: 4px; }
  .tipo-tag {
    display: inline-block; background: #e3f2fd; border: 1px solid #90caf9;
    color: #1565c0; font-size: 9.5px; font-weight: bold; padding: 2px 8px;
    border-radius: 12px; margin: 2px;
  }

  /* ── Texto con borde ── */
  .text-box { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px 8px; line-height: 1.6; color: #333; white-space: pre-wrap; }

  /* ── Lista de trabajos ── */
  .trabajos-list { list-style: none; padding: 0 4px; }
  .trabajos-list li { padding: 2px 0; padding-left: 14px; position: relative; line-height: 1.7; white-space: pre-wrap; }
  .trabajos-list li::before { content: '•'; position: absolute; left: 0; color: #1a7a6e; font-weight: bold; }

  /* ── Tabla items ── */
  table { width: 100%; border-collapse: collapse; }
  thead th {
    background: #f3f4f6; border: 1px solid #d1d5db;
    padding: 4px 8px; font-size: 9.5px; text-align: center; color: #374151;
  }
  tbody td { border: 1px solid #e5e7eb; padding: 4px 8px; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #f9fafb; }
  .center { text-align: center; }
  .right { text-align: right; }

  /* ── Totales ── */
  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 6px; }
  .totals { width: 180px; border-collapse: collapse; }
  .totals td { padding: 3px 8px; font-size: 10.5px; }
  .totals .total-row td { border-top: 1px solid #aaa; font-weight: bold; font-size: 13px; padding-top: 5px; }

  /* ── Evidencias ── */
  .ev-group { margin-bottom: 10px; }
  .ev-label { font-size: 9px; font-weight: bold; color: #555; text-transform: uppercase; margin-bottom: 5px; }
  .ev-imgs { display: flex; flex-wrap: wrap; gap: 8px; }
  .ev-img { width: 185px; height: 135px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; }

  /* ── Firma ── */
  .firma-section { margin-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
  .firma-box { text-align: center; width: 260px; }
  .firma-linea { border-top: 1px solid #333; width: 220px; margin: 0 auto 4px; padding-top: 40px; }
  .firma-label { font-size: 9px; color: #555; }
  .firma-fecha { font-size: 8px; color: #888; margin-top: 2px; }
  .payment-box { font-size: 9px; color: #555; line-height: 1.7; }
  .payment-title { font-weight: bold; color: #333; margin-bottom: 2px; }
</style>
</head>
<body>
<div class="watermark"></div>

<!-- Header empresa -->
<div class="header">
  <div class="company-center">
    <div class="company-name">${emp.nombre}</div>
    <div class="company-info">
      ${emp.direccion}<br>
      Tel: ${emp.telefono} | Email: ${emp.email} | Web: ${emp.web}
    </div>
  </div>
  ${LOGO_URL ? `<img src="${LOGO_URL}" class="logo-img" alt="${emp.nombre}" />` : ''}
</div>

<div class="body">

  <!-- Folio -->
  <div class="folio-row">
    <span class="folio">${d.folio}</span>
  </div>

  <!-- Datos generales -->
  <div class="section">
    <div class="section-title">Datos Generales</div>
    <div class="info-grid">
      <div class="info-row"><span class="info-label">Cliente:</span><span class="info-val">${d.cliente_nombre}</span></div>
      <div class="info-row"><span class="info-label">Técnico:</span><span class="info-val">${d.tecnico_nombre}</span></div>
      <div class="info-row"><span class="info-label">Fecha ingreso:</span><span class="info-val">${d.fecha_ingreso}</span></div>
      ${d.direccion_servicio ? `<div class="info-row full"><span class="info-label">Dirección de servicio:</span><span class="info-val">&nbsp;${d.direccion_servicio}</span></div>` : ''}
    </div>
  </div>

  <!-- Tipo de servicio -->
  ${d.tipo_servicio.length > 0 ? `
  <div class="section">
    <div class="section-title">Tipo de Servicio</div>
    <div class="tipo-tags">
      ${d.tipo_servicio.map((t) => `<span class="tipo-tag">${t}</span>`).join('')}
    </div>
  </div>` : ''}

  <!-- Falla reportada -->
  <div class="section">
    <div class="section-title">Falla Reportada</div>
    <div class="text-box">${d.falla_reportada}</div>
  </div>

  ${d.diagnostico ? `
  <!-- Diagnóstico -->
  <div class="section">
    <div class="section-title">Diagnóstico</div>
    <div class="text-box">${d.diagnostico}</div>
  </div>` : ''}

  <!-- Trabajos realizados -->
  <div class="section">
    <div class="section-title">Trabajos Realizados</div>
    <ul class="trabajos-list">${trabajosHtml}</ul>
  </div>

  <!-- Materiales y repuestos (siempre visible) -->
  <div class="section">
    <div class="section-title">Materiales y Repuestos</div>
    ${materialesHtml}
  </div>

  ${d.observaciones ? `
  <!-- Observaciones -->
  <div class="section">
    <div class="section-title">Observaciones</div>
    <div class="text-box" style="font-style:italic;color:#555">${d.observaciones}</div>
  </div>` : ''}

  ${evidenciasHtml ? `
  <!-- Evidencias -->
  <div class="section">
    <div class="section-title">Evidencias Fotográficas</div>
    ${evidenciasHtml}
  </div>` : ''}

  <!-- Firma y pago -->
  <div class="firma-section">
    <div class="payment-box">
      <div class="payment-title">Método de pago:</div>
      Banco: BBVA<br>
      Cuenta: 0480939986<br>
      CLABE: 012180004809399868<br>
      Titular: Pablo Alexander Ramírez Herrera
    </div>
    <div class="firma-box">
      ${firmaHtml}
      <div class="firma-label">Nombre y firma de quien corresponda la autorización:</div>
      ${d.firma_cliente
        ? ''
        : `<a href="#" style="font-size:9px;color:#1a7a6e">Haga clic aquí para firmar el reporte</a><br><span style="font-size:8px;color:#999">Firma pendiente</span>`
      }
      ${firmaFechaStr ? `<div class="firma-fecha">${firmaFechaStr}</div>` : ''}
    </div>
  </div>

</div>
</body>
</html>`
}

// ─── Puppeteer ────────────────────────────────────────────────

async function abrirBrowser() {
  // Render / cualquier server con ruta explícita configurada
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    })
  }

  // Vercel / AWS Lambda → usa @sparticuz/chromium
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 900 },
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  // Desarrollo local
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

export async function generarPDFReporte(datos: DatosReportePDF): Promise<Buffer> {
  const html = htmlReporte(datos)
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

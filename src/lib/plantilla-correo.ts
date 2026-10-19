// Diseño común de los correos que envía el ERP (cotizaciones, reportes, tickets).

export const CORREO_DIRECCION = 'direccion@didara-ti.com'

export function plantillaCorreo(titulo: string, subtitulo: string, contenido: string) {
  const anio = new Date().getFullYear()
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f1f5f9;font-family:Arial,sans-serif;">
<div style="max-width:640px;margin:0 auto;">
  <div style="background:#137D79;color:#fff;padding:22px 28px;border-radius:10px 10px 0 0;">
    <h2 style="margin:0;font-size:1.25rem;font-weight:800;">${titulo}</h2>
    <p style="margin:6px 0 0;opacity:.85;font-size:.85rem;">${subtitulo}</p>
  </div>
  <div style="background:#ffffff;padding:26px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
    ${contenido}
    <hr style="margin:24px 0;border:none;border-top:1px solid #f1f5f9;">
    <p style="margin:0;font-size:.78rem;color:#94a3b8;text-align:center;">
      Este mensaje fue enviado automáticamente por el sistema ERP de <strong>Didara TI</strong>.<br>
      Si tienes dudas, responde este correo o escríbenos a
      <a href="mailto:${CORREO_DIRECCION}" style="color:#137D79;">${CORREO_DIRECCION}</a>
    </p>
  </div>
  <p style="text-align:center;font-size:.72rem;color:#94a3b8;margin-top:12px;">
    © ${anio} Didara TI &nbsp;·&nbsp; didarobot@didara-ti.com
  </p>
</div>
</body></html>`
}

/** Botón de llamada a la acción para los correos */
export function botonCorreo(texto: string, url: string) {
  return `<p style="margin:20px 0 6px;"><a href="${url}" style="display:inline-block;background:#137D79;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 22px;border-radius:8px;">${texto}</a></p>`
}

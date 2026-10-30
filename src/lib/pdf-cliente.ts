// Del lado del navegador: avisa al servidor que probablemente se va a pedir un PDF
// para que abra Chrome por adelantado (ver /api/pdf/calentar). Como mucho cada 4 minutos.

const CLAVE = 'pdf_calentado_at'

export function calentarPDF() {
  try {
    if (Date.now() - Number(sessionStorage.getItem(CLAVE) ?? 0) < 4 * 60_000) return
    sessionStorage.setItem(CLAVE, String(Date.now()))
  } catch { /* sin almacenamiento: se avisa igual */ }
  void fetch('/api/pdf/calentar', { method: 'POST' }).catch(() => {})
}

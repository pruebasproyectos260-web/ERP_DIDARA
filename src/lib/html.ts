/** Escapa texto libre antes de insertarlo en HTML (correos, PDFs). */
export function escaparHtml(texto: unknown): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escapa y conserva los saltos de línea que escribió el usuario. */
export function escaparMultilinea(texto: unknown): string {
  return escaparHtml(texto).replace(/\r?\n/g, '<br>')
}

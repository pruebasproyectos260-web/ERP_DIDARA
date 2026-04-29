import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import os from 'os'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
// @ts-expect-error - sin tipos disponibles para este módulo comunitario
import ImageModule from 'docxtemplater-image-module-free'

// PNG 1×1 gris claro — fallback cuando un ítem no tiene imagen
export const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAABmJLR0QA/wD/AP+gvaeTAAAA' +
  'MUlEQVR42u3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBxAABHgAA' +
  'AQAAAABJRU5ErkJggg==',
  'base64'
)

export async function generarPDFDesdeDocx(
  tipo: string,
  datos: Record<string, unknown>
): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'templates', `${tipo}.docx`)

  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Template no encontrado: ${templatePath}. ` +
      `Crea el archivo templates/${tipo}.docx con los placeholders {campo}.`
    )
  }

  const templateContent = fs.readFileSync(templatePath, 'binary')
  const zip = new PizZip(templateContent)

  const imageModule = new ImageModule({
    centered: true,
    getImage(tagValue: unknown): Buffer {
      if (Buffer.isBuffer(tagValue)) return tagValue
      return PLACEHOLDER_PNG
    },
    getSize(): [number, number] {
      return [80, 80]
    },
  })

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
    modules: [imageModule],
  })

  await doc.renderAsync(datos)

  const docxBuffer = doc.getZip().generate({ type: 'nodebuffer' })

  const tmpDir = os.tmpdir()
  const tmpDocx = path.join(tmpDir, `didara_${tipo}_${Date.now()}.docx`)
  const tmpPdf = tmpDocx.replace('.docx', '.pdf')

  try {
    fs.writeFileSync(tmpDocx, docxBuffer)

    // Detectar ejecutable de LibreOffice según el SO
    const libreOfficePaths = [
      'libreoffice',                                           // Linux/Mac (en PATH)
      'soffice',                                              // Linux alternativo
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe', // Windows x64
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe', // Windows x86
    ]
    const libreOffice = libreOfficePaths.find((p) => {
      try { execSync(`"${p}" --version`, { stdio: 'pipe' }); return true } catch { return false }
    })
    if (!libreOffice) {
      throw new Error(
        'LibreOffice no está instalado. Descárgalo desde libreoffice.org e instálalo.'
      )
    }

    execSync(
      `"${libreOffice}" --headless --convert-to pdf --outdir "${tmpDir}" "${tmpDocx}"`,
      { timeout: 30000 }
    )

    if (!fs.existsSync(tmpPdf)) {
      throw new Error('LibreOffice no generó el PDF.')
    }

    return fs.readFileSync(tmpPdf)
  } finally {
    if (fs.existsSync(tmpDocx)) fs.unlinkSync(tmpDocx)
    if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf)
  }
}

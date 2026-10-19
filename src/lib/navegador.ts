import puppeteer, { type Browser, type Page } from 'puppeteer-core'

// Un solo Chrome compartido para todos los PDFs.
// Antes se lanzaba y cerraba un Chrome por cada PDF: en Render (CPU mínima) eso
// era la mayor parte del tiempo de espera. Se cierra solo tras unos minutos sin uso
// para no ocupar memoria.

const INACTIVIDAD_MS = 5 * 60_000

let navegador: Promise<Browser> | null = null
let temporizador: ReturnType<typeof setTimeout> | null = null
let enUso = 0

async function lanzar(): Promise<Browser> {
  // Cloud sin Chrome instalado: Render, Vercel, AWS Lambda → usa @sparticuz/chromium
  if (process.env.RENDER || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default
    return puppeteer.launch({
      args: [...chromium.args, '--disable-dev-shm-usage'],
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

function obtenerNavegador(): Promise<Browser> {
  if (!navegador) {
    navegador = lanzar()
      .then((b) => {
        b.on('disconnected', () => { navegador = null })
        return b
      })
      .catch((err) => {
        navegador = null
        throw err
      })
  }
  return navegador
}

async function cerrar() {
  const actual = navegador
  navegador = null
  if (actual) await (await actual).close().catch(() => {})
}

async function nuevaPagina(): Promise<Page> {
  try {
    return await (await obtenerNavegador()).newPage()
  } catch {
    // Chrome quedó en mal estado (p. ej. se cerró por memoria): relanzar una vez
    await cerrar()
    return (await obtenerNavegador()).newPage()
  }
}

/** Abre una pestaña en el Chrome compartido, ejecuta `fn` y la cierra. */
export async function conPagina<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  if (temporizador) { clearTimeout(temporizador); temporizador = null }
  enUso++
  try {
    const page = await nuevaPagina()
    try {
      return await fn(page)
    } finally {
      await page.close().catch(() => {})
    }
  } finally {
    enUso--
    if (enUso === 0) temporizador = setTimeout(() => { void cerrar() }, INACTIVIDAD_MS)
  }
}

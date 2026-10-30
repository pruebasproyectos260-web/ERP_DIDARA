import { prepararChromium } from '@/lib/navegador'

// Al arrancar en Render (después de cada despliegue o reinicio): deja Chrome descomprimido para que
// el primer PDF no tarde ~20 s. Se espera un poco para no competir con las primeras visitas.
if (process.env.RENDER) {
  setTimeout(() => { void prepararChromium().catch(() => {}) }, 15_000)
}

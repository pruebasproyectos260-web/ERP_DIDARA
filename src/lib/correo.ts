import { Resend } from 'resend'

interface OpcionesCorreo {
  para: string | string[]
  cc?: string | string[]
  asunto: string
  html: string
  adjuntos?: { filename: string; content: Buffer; contentType: string }[]
}

export async function enviarCorreo({ para, cc, asunto, html, adjuntos }: OpcionesCorreo) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY no configurada')

  const resend = new Resend(apiKey)

  const { error } = await resend.emails.send({
    from: 'Didara TI <didarobot@didara-ti.com>',
    to: Array.isArray(para) ? para : [para],
    cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
    subject: asunto,
    html,
    attachments: adjuntos?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  })

  if (error) throw new Error(error.message)
}

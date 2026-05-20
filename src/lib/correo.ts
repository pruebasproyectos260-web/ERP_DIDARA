import nodemailer from 'nodemailer'

interface OpcionesCorreo {
  para: string | string[]
  cc?: string | string[]
  asunto: string
  html: string
  adjuntos?: nodemailer.SendMailOptions['attachments']
}

export async function enviarCorreo({ para, cc, asunto, html, adjuntos }: OpcionesCorreo) {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error(`SMTP no configurado: HOST=${host ?? 'falta'} USER=${user ? 'ok' : 'falta'} PASS=${pass ? 'ok' : 'falta'}`)
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? '465'),
    secure: parseInt(process.env.SMTP_PORT ?? '465') === 465,
    auth: { user, pass },
  })

  return transporter.sendMail({
    from: `"Didara TI" <${user}>`,
    to: Array.isArray(para) ? para.join(', ') : para,
    cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
    subject: asunto,
    html,
    attachments: adjuntos,
  })
}

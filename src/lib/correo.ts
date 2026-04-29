import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

interface OpcionesCorreo {
  para: string | string[]
  cc?: string | string[]
  asunto: string
  html: string
  adjuntos?: nodemailer.SendMailOptions['attachments']
}

export async function enviarCorreo({ para, cc, asunto, html, adjuntos }: OpcionesCorreo) {
  return transporter.sendMail({
    from: `"Didara TI" <${process.env.SMTP_USER}>`,
    to: Array.isArray(para) ? para.join(', ') : para,
    cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
    subject: asunto,
    html,
    attachments: adjuntos,
  })
}

import { createTransport } from 'nodemailer'

type Attachment = { filename: string; content: Buffer; contentType: string }

export async function sendEmail(input: {
  to: string
  subject: string
  text: string
  attachments?: Attachment[]
}) {
  const host = process.env.SMTP_HOST ?? 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT ?? 587)
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD
  const from = process.env.SMTP_FROM ?? user
  if (!user || !pass || !from) throw new Error('SMTP nao esta configurado para envio de cobrancas.')

  const html = input.text
    .split(/\r?\n/)
    .map((line) => line.trim() ? `<p style="margin:0 0 14px">${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>` : '<br>')
    .join('')
  const transport = createTransport({ host, port, secure, auth: { user, pass } })
  return transport.sendMail({
    to: input.to,
    from,
    subject: input.subject,
    text: input.text,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1c2434;line-height:1.6">${html}</div>`,
    attachments: input.attachments,
  })
}

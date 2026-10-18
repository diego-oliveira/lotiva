import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { createTransport } from 'nodemailer'
import { prisma } from './prisma'
import { isAdminEligibleEmail } from './auth'

const codeLifetimeMinutes = 10
const resendDelaySeconds = 60
const maxAttempts = 5

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function getSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET or NEXTAUTH_SECRET is required.')
  return secret
}

function hashCode(email: string, code: string) {
  return createHmac('sha256', getSecret()).update(`${normalizeEmail(email)}:${code}`).digest('hex')
}

function hashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

async function sendCodeEmail(email: string, code: string) {
  if (process.env.NODE_ENV !== 'production' && process.env.AUTH_PRINT_MAGIC_LINKS === 'true') {
    console.log(`\nLotiva access code for ${email}: ${code}\n`)
    return
  }

  const host = process.env.SMTP_HOST ?? 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT ?? 587)
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD
  const from = process.env.SMTP_FROM ?? user
  if (!user || !pass || !from) throw new Error('Missing SMTP environment variables.')

  const transport = createTransport({ host, port, secure, auth: { user, pass } })
  await transport.sendMail({
    to: email,
    from,
    subject: `${code} e o seu codigo de acesso ao Lotiva`,
    text: `Seu codigo de acesso ao Lotiva e ${code}. Ele expira em ${codeLifetimeMinutes} minutos e pode ser usado uma unica vez.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1c2434">
        <div style="display:inline-flex;width:48px;height:48px;align-items:center;justify-content:center;border-radius:12px;background:#3c50e0;color:#fff;font-weight:700">L</div>
        <h1 style="font-size:22px;margin:24px 0 12px">Seu codigo de acesso</h1>
        <p style="font-size:15px;line-height:1.6">Digite este codigo na tela do Lotiva:</p>
        <p style="margin:24px 0;font-size:34px;line-height:1;letter-spacing:10px;font-weight:800;color:#2536b8">${code}</p>
        <p style="font-size:13px;line-height:1.6;color:#64748b">O codigo expira em ${codeLifetimeMinutes} minutos e pode ser usado uma unica vez. Se voce nao solicitou este acesso, ignore este email.</p>
      </div>
    `,
  })
}

export async function requestLoginCode(rawEmail: string) {
  const email = normalizeEmail(rawEmail)
  if (!(await isAdminEligibleEmail(email))) return { sent: true as const }

  const existing = await prisma.loginCode.findUnique({ where: { email } })
  if (existing && Date.now() - existing.updatedAt.getTime() < resendDelaySeconds * 1000) {
    return { sent: true as const }
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  await prisma.loginCode.upsert({
    where: { email },
    update: {
      codeHash: hashCode(email, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + codeLifetimeMinutes * 60 * 1000),
    },
    create: {
      email,
      codeHash: hashCode(email, code),
      expiresAt: new Date(Date.now() + codeLifetimeMinutes * 60 * 1000),
    },
  })

  try {
    await sendCodeEmail(email, code)
  } catch (error) {
    await prisma.loginCode.deleteMany({ where: { email } })
    throw error
  }

  return { sent: true as const }
}

export async function consumeLoginCode(rawEmail: string, rawCode: string) {
  const email = normalizeEmail(rawEmail)
  const code = rawCode.replace(/\D/g, '')
  const record = await prisma.loginCode.findUnique({ where: { email } })
  if (!record || record.expiresAt <= new Date() || record.attempts >= maxAttempts) {
    if (record) await prisma.loginCode.deleteMany({ where: { email } })
    return null
  }

  if (code.length !== 6 || !hashesMatch(record.codeHash, hashCode(email, code))) {
    const attempts = record.attempts + 1
    if (attempts >= maxAttempts) await prisma.loginCode.deleteMany({ where: { email } })
    else await prisma.loginCode.update({ where: { email }, data: { attempts } })
    return null
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
  })
  if (!user || !(await isAdminEligibleEmail(user.email))) return null

  await prisma.loginCode.delete({ where: { email } })
  return user
}

export function safeCallbackUrl(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

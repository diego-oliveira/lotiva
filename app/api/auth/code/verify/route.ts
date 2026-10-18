import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { consumeLoginCode, safeCallbackUrl } from '@/lib/login-code'
import { prisma } from '@/lib/prisma'

const sessionDurationSeconds = 30 * 24 * 60 * 60

export async function POST(request: Request) {
  const data = await request.json().catch(() => null)
  const email = typeof data?.email === 'string' ? data.email : ''
  const code = typeof data?.code === 'string' ? data.code : ''
  const user = await consumeLoginCode(email, code)

  if (!user) {
    return NextResponse.json({ error: 'Codigo invalido ou expirado.' }, { status: 401 })
  }

  const sessionToken = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + sessionDurationSeconds * 1000)
  await prisma.$transaction([
    prisma.session.create({ data: { sessionToken, userId: user.id, expires } }),
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } }),
  ])

  const secure = process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https://')
  const response = NextResponse.json({ ok: true, url: safeCallbackUrl(data?.callbackUrl) })
  response.cookies.set(secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: sessionDurationSeconds,
    expires,
  })
  return response
}

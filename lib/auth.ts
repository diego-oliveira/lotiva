import { PrismaAdapter } from '@auth/prisma-adapter'
import type { Adapter } from 'next-auth/adapters'
import { getServerSession, type NextAuthOptions, type Session } from 'next-auth'
import EmailProvider from 'next-auth/providers/email'
import { createTransport } from 'nodemailer'
import type { SendVerificationRequestParams } from 'next-auth/providers/email'
import { NextResponse } from 'next/server'
import { prisma } from './prisma'

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

const smtpHost = process.env.SMTP_HOST ?? 'smtp.gmail.com'
const smtpPort = Number(process.env.SMTP_PORT ?? 587)
const smtpSecure = process.env.SMTP_SECURE === 'true'
const smtpUser = process.env.SMTP_USER
const smtpPassword = process.env.SMTP_PASSWORD
const smtpFrom = process.env.SMTP_FROM ?? smtpUser
const prismaAdapter = PrismaAdapter(prisma as never) as Adapter
const shouldPrintMagicLinks =
  process.env.NODE_ENV !== 'production' && process.env.AUTH_PRINT_MAGIC_LINKS === 'true'

type AuthenticatedSession = Session & {
  user: NonNullable<Session['user']> & {
    id: string
    email: string
  }
}

export async function isAdminEligibleEmail(email?: string | null) {
  if (!email) return false

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      memberships: {
        where: {
          roles: {
            some: {},
          },
        },
        select: { id: true },
        take: 1,
      },
    },
  })

  return Boolean(user?.memberships.length)
}

async function sendMagicLinkEmail({
  identifier,
  url,
  provider,
}: SendVerificationRequestParams) {
  console.info(`[auth] Magic link requested for ${identifier}`)

  const isEligible = await isAdminEligibleEmail(identifier)

  if (!isEligible) {
    console.warn(`[auth] Magic link skipped because ${identifier} is not linked to any development`)
    return
  }

  if (shouldPrintMagicLinks) {
    console.log(`\nLotiva magic link for ${identifier}:\n${url}\n`)
    return
  }

  if (!smtpUser || !smtpPassword || !smtpFrom) {
    console.error('[auth] Missing SMTP environment variables')
    throw new Error('Missing Gmail SMTP environment variables.')
  }

  const { host } = new URL(url)
  const transport = createTransport(provider.server)

  try {
    await transport.sendMail({
      to: identifier,
      from: provider.from,
      subject: 'Acesse o Lotiva',
      text: `Acesse o Lotiva\n\n${url}\n\nEste link expira em breve. Se voce nao solicitou este acesso, ignore este email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c2434;">
          <h1 style="font-size: 22px; margin-bottom: 16px;">Acesse o Lotiva</h1>
          <p style="font-size: 15px; line-height: 1.6;">Use o botao abaixo para acessar sua conta no Lotiva.</p>
          <p style="margin: 28px 0;">
            <a href="${url}" style="display: inline-block; background: #3c50e0; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">
              Acessar
            </a>
          </p>
          <p style="font-size: 13px; line-height: 1.6; color: #64748b;">Este link foi solicitado para ${host}. Se voce nao solicitou este acesso, ignore este email.</p>
        </div>
      `,
    })
    console.info(`[auth] Magic link sent to ${identifier}`)
  } catch (error) {
    console.error(`[auth] Failed to send magic link to ${identifier}`, error)
    throw error
  }
}

export const authOptions: NextAuthOptions = {
  adapter: {
    ...prismaAdapter,
    async getUserByEmail(email) {
      return prisma.user.findFirst({
        where: {
          email: {
            equals: email,
            mode: 'insensitive',
          },
        },
      }) as ReturnType<NonNullable<Adapter['getUserByEmail']>>
    },
    async createUser() {
      throw new Error('Public user creation is disabled.')
    },
  },
  secret: authSecret,
  session: {
    strategy: 'database',
  },
  providers: [
    EmailProvider({
      server: {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      },
      from: smtpFrom,
      maxAge: 60 * 30,
      sendVerificationRequest: sendMagicLinkEmail,
    }),
  ],
  pages: {
    signIn: '/signin',
    verifyRequest: '/auth/verify-request',
    error: '/signin',
  },
  callbacks: {
    async signIn({ user, email }) {
      if (email?.verificationRequest) {
        return true
      }

      return isAdminEligibleEmail(user.email)
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }

      return session
    },
  },
}

export async function getCurrentSession() {
  return getServerSession(authOptions)
}

export async function requireAuthenticatedUser() {
  const session = await getCurrentSession()

  if (!session?.user?.email || !session.user.id) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const isEligible = await isAdminEligibleEmail(session.user.email)

  if (!isEligible) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { session: session as AuthenticatedSession, response: null }
}

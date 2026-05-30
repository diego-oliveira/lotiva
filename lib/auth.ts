import { PrismaAdapter } from '@auth/prisma-adapter'
import type { Adapter } from 'next-auth/adapters'
import { getServerSession, type NextAuthOptions } from 'next-auth'
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
  const isEligible = await isAdminEligibleEmail(identifier)

  if (!isEligible) {
    return
  }

  if (!smtpUser || !smtpPassword || !smtpFrom) {
    throw new Error('Missing Gmail SMTP environment variables.')
  }

  const { host } = new URL(url)
  const transport = createTransport(provider.server)

  await transport.sendMail({
    to: identifier,
    from: provider.from,
    subject: `Sign in to Lotiva`,
    text: `Sign in to Lotiva\n\n${url}\n\nThis link expires soon. If you did not request it, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1c2434;">
        <h1 style="font-size: 22px; margin-bottom: 16px;">Sign in to Lotiva</h1>
        <p style="font-size: 15px; line-height: 1.6;">Use the button below to access your Lotiva workspace.</p>
        <p style="margin: 28px 0;">
          <a href="${url}" style="display: inline-block; background: #3c50e0; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">
            Sign in
          </a>
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #64748b;">This link was requested for ${host}. If you did not request it, you can ignore this email.</p>
      </div>
    `,
  })
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

  if (!session?.user?.email) {
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

  return { session, response: null }
}

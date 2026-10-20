import { createHash, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

export const IMPERSONATION_COOKIE = 'lotiva_impersonation'
export const IMPERSONATION_DURATION_MS = 30 * 60 * 1000

export function isSystemOwner(user: { id: string; email?: string | null }) {
  const ownerId = process.env.SYSTEM_OWNER_USER_ID?.trim()
  const ownerEmail = process.env.SYSTEM_OWNER_EMAIL?.trim().toLowerCase()

  if (ownerId) return user.id === ownerId
  return Boolean(ownerEmail && user.email?.toLowerCase() === ownerEmail)
}

export function hashImpersonationToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createImpersonationSession(actorId: string, targetId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + IMPERSONATION_DURATION_MS)

  await prisma.impersonationSession.updateMany({
    where: { actorId, endedAt: null },
    data: { endedAt: new Date() },
  })
  await prisma.impersonationSession.create({
    data: { actorId, targetId, expiresAt, tokenHash: hashImpersonationToken(token) },
  })

  return { token, expiresAt }
}

export async function getActiveImpersonation(actorId: string) {
  const token = (await cookies()).get(IMPERSONATION_COOKIE)?.value
  if (!token) return null

  return prisma.impersonationSession.findFirst({
    where: {
      actorId,
      tokenHash: hashImpersonationToken(token),
      endedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { target: true },
  })
}

export async function endActiveImpersonation(actorId: string) {
  const token = (await cookies()).get(IMPERSONATION_COOKIE)?.value
  if (!token) return

  await prisma.impersonationSession.updateMany({
    where: { actorId, tokenHash: hashImpersonationToken(token), endedAt: null },
    data: { endedAt: new Date() },
  })
}

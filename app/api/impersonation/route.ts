import { getOriginalSession, isAdminEligibleEmail } from '@/lib/auth'
import {
  createImpersonationSession,
  endActiveImpersonation,
  IMPERSONATION_COOKIE,
  IMPERSONATION_DURATION_MS,
  isSystemOwner,
} from '@/lib/impersonation'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

async function requireOwner() {
  const session = await getOriginalSession()
  if (!session?.user?.id || !session.user.email) return { session: null, error: 401 }
  if (!isSystemOwner(session.user)) return { session: null, error: 403 }
  return { session, error: null }
}

export async function GET() {
  const auth = await requireOwner()
  return auth.error
    ? NextResponse.json({ canImpersonate: false }, { status: auth.error })
    : NextResponse.json({ canImpersonate: true, ownerId: auth.session?.user?.id })
}

export async function POST(request: Request) {
  const auth = await requireOwner()
  if (auth.error || !auth.session?.user?.id) {
    return NextResponse.json({ error: auth.error === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.error ?? 403 })
  }

  const body = await request.json().catch(() => null)
  const targetId = typeof body?.targetId === 'string' ? body.targetId : ''
  if (!targetId || targetId === auth.session.user.id) {
    return NextResponse.json({ error: 'Selecione outro usuario.' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, email: true } })
  if (!target || !(await isAdminEligibleEmail(target.email))) {
    return NextResponse.json({ error: 'Esta pessoa nao possui acesso ao sistema.' }, { status: 400 })
  }

  const impersonation = await createImpersonationSession(auth.session.user.id, target.id)
  const response = NextResponse.json({ user: target, expiresAt: impersonation.expiresAt })
  response.cookies.set(IMPERSONATION_COOKIE, impersonation.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: IMPERSONATION_DURATION_MS / 1000,
  })
  return response
}

export async function DELETE() {
  const auth = await requireOwner()
  if (auth.error || !auth.session?.user?.id) {
    return NextResponse.json({ error: auth.error === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.error ?? 403 })
  }

  await endActiveImpersonation(auth.session.user.id)
  const response = NextResponse.json({ success: true })
  response.cookies.set(IMPERSONATION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'lax' })
  return response
}

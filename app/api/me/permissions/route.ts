import { requireAuthenticatedUser } from '@/lib/auth'
import { getUserPermissions } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { isSystemOwner } from '@/lib/impersonation'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const permissions = await getUserPermissions(auth.session.user.id)
  return NextResponse.json({
    ...permissions,
    user: {
      id: auth.session.user.id,
      name: auth.session.user.name,
      email: auth.session.user.email,
    },
    canImpersonate: !auth.impersonation && isSystemOwner(auth.originalSession.user),
    impersonation: auth.impersonation ? {
      expiresAt: auth.impersonation.expiresAt,
      actor: {
        id: auth.originalSession.user.id,
        name: auth.originalSession.user.name,
        email: auth.originalSession.user.email,
      },
      target: {
        id: auth.session.user.id,
        name: auth.session.user.name,
        email: auth.session.user.email,
      },
    } : null,
  })
}

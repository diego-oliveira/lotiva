import { requireAuthenticatedUser } from '@/lib/auth'
import { getUserPermissions } from '@/lib/permissions'
import { NextResponse } from 'next/server'

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
  })
}

import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { ensureBaseRoles } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  await ensureBaseRoles()
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(roles)
}

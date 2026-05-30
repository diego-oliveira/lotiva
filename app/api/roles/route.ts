import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(roles)
}

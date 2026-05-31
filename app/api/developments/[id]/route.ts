import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, membershipWhere } from '@/lib/access-control'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params

  const development = await prisma.development.findFirst({
    where: {
      id,
      ...membershipWhere(userId),
    },
    include: {
      company: true,
      settings: true,
      _count: {
        select: {
          blocks: true,
        },
      },
    },
  })

  if (!development) {
    return NextResponse.json({ error: 'Development not found' }, { status: 404 })
  }

  return NextResponse.json(development)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params
  const data = await req.json()

  const canAccessDevelopment = await prisma.development.count({
    where: {
      id,
      ...membershipWhere(userId),
    },
  })
  if (!canAccessDevelopment) return forbiddenResponse()

  const updated = await prisma.development.update({
    where: { id },
    data: {
      name: data.name,
      logo: data.logo,
      companyId: data.companyId,
      updatedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}

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

  const company = await prisma.company.findFirst({
    where: {
      id,
      OR: [
        { developments: { some: membershipWhere(userId) } },
        { developments: { none: {} } },
      ],
    },
    include: {
      _count: {
        select: {
          developments: {
            where: membershipWhere(userId),
          },
        },
      },
    },
  })

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  return NextResponse.json(company)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params
  const data = await req.json()
  const company = await prisma.company.findFirst({
    where: {
      id,
      OR: [
        { developments: { some: membershipWhere(userId) } },
        { developments: { none: {} } },
      ],
    },
    select: { id: true },
  })
  if (!company) return forbiddenResponse()

  const updated = await prisma.company.update({
    where: { id },
    data: {
      name: data.name,
      logo: data.logo,
      updatedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}

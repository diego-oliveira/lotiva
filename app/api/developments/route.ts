import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, membershipWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const developments = await prisma.development.findMany({
    where: membershipWhere(userId),
    include: {
      company: true,
      _count: {
        select: {
          blocks: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(developments)
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const data = await req.json()

  const company = await prisma.company.findUnique({
    where: { id: data.companyId },
    select: { id: true },
  })
  if (!company) return forbiddenResponse()

  const development = await prisma.development.create({
    data: {
      name: data.name,
      logo: data.logo,
      companyId: data.companyId,
      memberships: {
        create: {
          userId,
          roles: {
            create: {
              role: {
                connectOrCreate: {
                  where: { name: 'OWNER' },
                  create: { name: 'OWNER' },
                },
              },
            },
          },
        },
      },
    },
  })

  return NextResponse.json(development, { status: 201 })
}

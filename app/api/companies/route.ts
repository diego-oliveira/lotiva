import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { membershipWhere } from '@/lib/access-control'
import { isValidUploadedImagePath } from '@/lib/uploadStorage'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const companies = await prisma.company.findMany({
    where: {
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
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(companies)
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const data = await req.json()
  if (!isValidUploadedImagePath(String(data.logo || ''))) {
    return NextResponse.json({ error: 'Envie uma imagem valida para o logo.' }, { status: 400 })
  }

  const company = await prisma.company.create({
    data: {
      name: data.name,
      logo: data.logo,
    },
  })

  return NextResponse.json(company, { status: 201 })
}

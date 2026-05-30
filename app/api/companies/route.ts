import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const companies = await prisma.company.findMany({
    include: {
      _count: {
        select: {
          developments: true,
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

  const company = await prisma.company.create({
    data: {
      name: data.name,
      logo: data.logo,
    },
  })

  return NextResponse.json(company, { status: 201 })
}

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const developments = await prisma.development.findMany({
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
  const data = await req.json()

  const development = await prisma.development.create({
    data: {
      name: data.name,
      logo: data.logo,
      companyId: data.companyId,
    },
  })

  return NextResponse.json(development, { status: 201 })
}

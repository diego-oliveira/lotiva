import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const { id } = await params

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          developments: true,
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

  const { id } = await params
  const data = await req.json()

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

// app/api/blocks/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { blockAccessWhere, forbiddenResponse, hasAccessToDevelopment } from '@/lib/access-control'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const blocks = await prisma.block.findMany({
    where: blockAccessWhere(userId),
    include: { lots: true, development: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(blocks)
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const data = await req.json()
  if (!data.developmentId) {
    return NextResponse.json({ error: 'Development is required.' }, { status: 400 })
  }

  const canAccessDevelopment = await hasAccessToDevelopment(userId, data.developmentId)
  if (!canAccessDevelopment) return forbiddenResponse()

  const newBlock = await prisma.block.create({
    data: {
      identifier: data.identifier,
      developmentId: data.developmentId,
    },
  })

  return NextResponse.json(newBlock, { status: 201 })
}

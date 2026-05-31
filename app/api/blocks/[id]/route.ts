import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { blockAccessWhere, forbiddenResponse, hasAccessToDevelopment } from '@/lib/access-control'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params
  const block = await prisma.block.findFirst({
    where: {
      id,
      ...blockAccessWhere(userId),
    },
    include: { lots: true, development: true },
  })
  if (!block) return NextResponse.json({ error: 'Block not found' }, { status: 404 })
  return NextResponse.json(block)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params
  const data = await req.json()
  const block = await prisma.block.findFirst({
    where: {
      id,
      ...blockAccessWhere(userId),
    },
    select: { id: true },
  })
  if (!block) return forbiddenResponse()

  if (data.developmentId) {
    const canAccessDevelopment = await hasAccessToDevelopment(userId, data.developmentId)
    if (!canAccessDevelopment) return forbiddenResponse()
  }

  const updated = await prisma.block.update({
    where: { id },
    data: {
      identifier: data.identifier,
      developmentId: data.developmentId,
      updatedAt: new Date(),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params
  const block = await prisma.block.findFirst({
    where: {
      id,
      ...blockAccessWhere(userId),
    },
    select: { id: true },
  })
  if (!block) return forbiddenResponse()

  await prisma.block.delete({
    where: { id },
  })
  return NextResponse.json({ deleted: true })
}

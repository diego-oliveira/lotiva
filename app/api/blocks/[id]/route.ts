import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const block = await prisma.block.findUnique({
    where: { id },
    include: { lots: true },
  })
  if (!block) return NextResponse.json({ error: 'Block not found' }, { status: 404 })
  return NextResponse.json(block)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await req.json()
  const updated = await prisma.block.update({
    where: { id },
    data: {
      identifier: data.identifier,
      updatedAt: new Date(),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.block.delete({
    where: { id },
  })
  return NextResponse.json({ deleted: true })
}
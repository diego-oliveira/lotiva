import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: { id: string } }

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { id } = params

  const block = await prisma.block.findUnique({
    where: { id },
    include: { lots: true },
  })

  if (!block) return NextResponse.json({ error: 'Block not found' }, { status: 404 })

  return NextResponse.json(block)
}

export async function PUT(req: Request, { params }: Params) {
  const data = await req.json()

  const updated = await prisma.block.update({
    where: { id: params.id },
    data: {
      identifier: data.identifier,
      updatedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: Params) {
  await prisma.block.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ deleted: true })
}

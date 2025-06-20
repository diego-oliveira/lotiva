// app/api/blocks/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const blocks = await prisma.block.findMany({
    include: { lots: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(blocks)
}

export async function POST(req: Request) {
  const data = await req.json()

  const newBlock = await prisma.block.create({
    data: {
      identifier: data.identifier,
    },
  })

  return NextResponse.json(newBlock, { status: 201 })
}

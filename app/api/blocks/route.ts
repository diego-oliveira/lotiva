// app/api/blocks/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const blocks = await prisma.block.findMany({
    include: { lots: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(blocks)
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const data = await req.json()

  const newBlock = await prisma.block.create({
    data: {
      identifier: data.identifier,
    },
  })

  return NextResponse.json(newBlock, { status: 201 })
}

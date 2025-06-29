import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ saleId: string }> }

export async function GET(_: Request, { params }: Params) {
  try {
    const { saleId } = await params

    const contract = await prisma.contract.findUnique({
      where: { saleId },
      include: {
        sale: {
          include: {
            customer: true,
            lot: {
              include: {
                block: true
              }
            }
          }
        }
      }
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    return new NextResponse(contract.content, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Error fetching contract:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contract' },
      { status: 500 }
    )
  }
}
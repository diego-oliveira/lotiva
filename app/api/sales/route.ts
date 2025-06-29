// app/api/sales/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateContractNumber, generateContractHTML } from '@/lib/contractGenerator'

export async function GET() {
  const sales = await prisma.sale.findMany({
    include: { 
      customer: true, 
      lot: {
        include: {
          block: true
        }
      },
      reservation: true,
      contract: true
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(sales)
}

export async function POST(req: Request) {
  const data = await req.json()

  try {
    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (prisma) => {
      // Create the sale
      const sale = await prisma.sale.create({
        data: {
          customerId: data.customerId,
          lotId: data.lotId,
          reservationId: data.reservationId || null,
          installmentCount: data.installmentCount,
          installmentValue: data.installmentValue,
          downPayment: data.downPayment,
          annualAdjustment: data.annualAdjustment,
          totalValue: data.totalValue,
        },
        include: {
          customer: true,
          lot: {
            include: {
              block: true
            }
          },
          reservation: true
        }
      })

      // Update lot status to sold
      await prisma.lot.update({
        where: { id: data.lotId },
        data: { status: 'sold' }
      })

      // Auto-generate contract
      try {
        const contractNumber = generateContractNumber()
        const contractData = {
          contractNumber,
          sale,
          generatedAt: new Date()
        }
        const contractHTML = generateContractHTML(contractData)

        await prisma.contract.create({
          data: {
            saleId: sale.id,
            contractNumber,
            content: contractHTML
          }
        })
      } catch (contractError) {
        console.error('Error auto-generating contract:', contractError)
        // Don't fail the sale creation if contract generation fails
      }

      return sale
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error creating sale:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This lot is already sold or reserved.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Failed to create sale.' }, { status: 500 })
  }
}
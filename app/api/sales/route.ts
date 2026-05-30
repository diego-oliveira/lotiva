// app/api/sales/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { generateContractNumber, generateContractHTML } from '@/lib/contractGenerator'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const sales = await prisma.sale.findMany({
    include: { 
      user: true, 
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
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const data = await req.json()

  try {
    // Validate user has all fields required for contract generation
    const user = await prisma.user.findUnique({ where: { id: data.userId } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 400 })
    }
    const missing = (['cpf', 'rg', 'address', 'birthDate', 'profession', 'birthplace', 'maritalStatus'] as const)
      .filter((f) => !user[f])
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'O usuario nao tem todos os dados legais preenchidos. Complete o cadastro antes de criar uma venda.', missingFields: missing },
        { status: 400 },
      )
    }

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (prisma) => {
      // Create the sale
      const sale = await prisma.sale.create({
        data: {
          userId: data.userId,
          lotId: data.lotId,
          reservationId: data.reservationId || null,
          installmentCount: data.installmentCount,
          installmentValue: data.installmentValue,
          downPayment: data.downPayment,
          annualAdjustment: data.annualAdjustment,
          totalValue: data.totalValue,
        },
        include: {
          user: true,
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

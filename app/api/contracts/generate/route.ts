import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateContractNumber, generateContractHTML } from '@/lib/contractGenerator'

export async function POST(req: Request) {
  try {
    const { saleId } = await req.json()

    if (!saleId) {
      return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 })
    }

    // Get the sale with all related data
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        lot: {
          include: {
            block: true
          }
        },
        contract: true
      }
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Check if contract already exists
    if (sale.contract) {
      return NextResponse.json({
        message: 'Contract already exists',
        contract: sale.contract
      })
    }

    // Generate contract
    const contractNumber = generateContractNumber()
    const contractData = {
      contractNumber,
      sale,
      generatedAt: new Date()
    }

    const contractHTML = generateContractHTML(contractData)

    // Save contract to database
    const contract = await prisma.contract.create({
      data: {
        saleId,
        contractNumber,
        content: contractHTML
      }
    })

    return NextResponse.json({
      message: 'Contract generated successfully',
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        createdAt: contract.createdAt
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error generating contract:', error)
    return NextResponse.json(
      { error: 'Failed to generate contract' },
      { status: 500 }
    )
  }
}
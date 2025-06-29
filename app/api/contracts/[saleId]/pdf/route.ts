import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateContractPDF } from '@/lib/pdfGenerator'

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

    // Generate PDF
    const contractData = {
      contractNumber: contract.contractNumber,
      sale: contract.sale,
      generatedAt: contract.createdAt
    }

    const pdfBuffer = await generateContractPDF(contractData)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Contrato_${contract.contractNumber}.pdf"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
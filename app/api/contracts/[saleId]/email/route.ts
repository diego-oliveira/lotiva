import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateContractPDF } from '@/lib/pdfGenerator'
import { emailService } from '@/lib/emailService'

type Params = { params: Promise<{ saleId: string }> }

export async function POST(req: Request, { params }: Params) {
  try {
    const { saleId } = await params
    const { customMessage } = await req.json()

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

    // Send email
    const emailSent = await emailService.sendContractEmail(
      contract.sale.customer.email,
      contract.sale.customer.name,
      contract.contractNumber,
      pdfBuffer,
      customMessage
    )

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      )
    }

    // Update contract email status
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        emailSent: true,
        emailSentAt: new Date()
      }
    })

    return NextResponse.json({
      message: 'Contract sent successfully',
      sentTo: contract.sale.customer.email
    })

  } catch (error) {
    console.error('Error sending contract email:', error)
    return NextResponse.json(
      { error: 'Failed to send contract email' },
      { status: 500 }
    )
  }
}
import { prisma } from '@/lib/prisma';
import { requireAuthenticatedUser } from '@/lib/auth'
import { NextResponse } from 'next/server';
import { generateContractPDFProduction } from '@/lib/pdfGeneratorProduction';

type Params = { params: Promise<{ saleId: string }> };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  try {
    const { saleId } = await params;

    const contract = await prisma.contract.findUnique({
      where: { saleId },
      include: {
        sale: {
          include: {
            user: true,
            lot: {
              include: {
                block: true
              }
            }
          }
        }
      }
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Generate PDF
    const contractData = {
      contractNumber: contract.contractNumber,
      sale: contract.sale,
      generatedAt: contract.createdAt
    };

    console.log('Generating PDF for contract:', contract.contractNumber);
    const pdfBuffer = await generateContractPDFProduction(contractData);
    console.log('PDF generated successfully, size:', pdfBuffer.length);

    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Contrato_${contract.contractNumber}.pdf"`,
        'Cache-Control': 'no-cache',
        'Content-Length': pdfBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

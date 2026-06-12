import { prisma } from '@/lib/prisma';
import { requireAuthenticatedUser } from '@/lib/auth'
import { contractAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server';
import { generatePDFFromHTMLProduction } from '@/lib/pdfGeneratorProduction';
import { emailService } from '@/lib/emailService';

type Params = { params: Promise<{ saleId: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  try {
    const { saleId } = await params;
    const { customMessage } = await req.json();

    const contract = await prisma.contract.findFirst({
      where: {
        saleId,
        ...contractAccessWhere(currentUserId),
      },
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

    const pdfBuffer = await generatePDFFromHTMLProduction(contract.content);

    // Send email
    const emailSent = await emailService.sendContractEmail(
      contract.sale.user.email,
      contract.sale.user.name,
      contract.contractNumber,
      pdfBuffer,
      customMessage
    );

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Nao foi possivel enviar o email. Verifique a configuracao SMTP.' },
        { status: 500 }
      );
    }

    // Update contract email status
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'sent',
        emailSent: true,
        emailSentAt: new Date(),
        events: {
          create: {
            userId: currentUserId,
            type: 'sent',
            title: 'Contrato enviado por email',
            description: `Enviado para ${contract.sale.user.email}`,
          },
        },
      }
    });

    return NextResponse.json({
      message: 'Contrato enviado com sucesso.',
      sentTo: contract.sale.user.email
    });
  } catch (error) {
    console.error('Error sending contract email:', error);
    return NextResponse.json(
      {
        error: 'Nao foi possivel enviar o contrato por email.',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

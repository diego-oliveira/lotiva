import { documentTemplateAccessWhere, forbiddenResponse } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { renderDocxTemplate } from '@/lib/docxDocuments'
import { readDocumentFile } from '@/lib/documentStorage'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const versionId = searchParams.get('versionId')

  const template = await prisma.documentTemplate.findFirst({
    where: { id, ...documentTemplateAccessWhere(userId) },
    include: {
      company: { include: { documentVariables: true } },
      versions: {
        where: versionId ? { id: versionId } : {},
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  })
  const version = template?.versions[0]
  if (!template || !version) return forbiddenResponse()

  const generatedAt = new Date()
  const sale = {
    totalValue: '88500.00',
    downPayment: '8850.00',
    installmentCount: 120,
    installmentValue: '663.75',
    firstDueDate: new Date('2026-07-25T00:00:00.000Z'),
    annualAdjustment: true,
    user: {
      name: 'Cliente Exemplo da Silva',
      email: 'cliente.exemplo@lotiva.com.br',
      cpf: '00000000000',
      rg: '0000000 SSP/BA',
      address: 'Rua Exemplo, 123, Centro, Feira de Santana - BA',
      birthDate: new Date('1985-04-15T00:00:00.000Z'),
      profession: 'Empresaria',
      birthplace: 'Feira de Santana - BA',
      maritalStatus: 'Solteira',
    },
    lot: {
      identifier: '4',
      totalArea: 250,
      front: 10,
      back: 10,
      leftSide: 25,
      rightSide: 25,
      block: {
        identifier: 'B',
        development: {
          name: 'Loteamento Exemplo',
          company: template.company,
          contractSettings: {
            sellerName: template.company.name,
            sellerDocument: template.company.document || '00.000.000/0001-00',
            sellerAddress: template.company.address || 'Endereco exemplo da empresa',
            sellerRepresentatives: 'Representante Exemplo',
            propertyDescription: 'Descricao exemplo do empreendimento.',
            acquisitionDescription: 'Origem exemplo do imovel.',
            paymentInstructions: 'Instrucoes de pagamento exemplo.',
            jurisdiction: 'Feira de Santana - BA',
            additionalClauses: 'Clausulas adicionais exemplo.',
          },
          documentValues: template.company.documentVariables.map((variable) => ({
            value: variable.defaultValue || `Valor exemplo para ${variable.label}`,
            variable: {
              key: variable.key,
              defaultValue: variable.defaultValue,
            },
          })),
        },
      },
    },
    proposal: {
      notes: 'Observacao exemplo da proposta.',
      interestRate: 0,
      correctionIndex: 'INCC',
    },
  }

  const rendered = renderDocxTemplate({
    template: await readDocumentFile(version.filePath),
    sale,
    contractNumber: 'CT202609060001',
    generatedAt,
  })
  if (!rendered.buffer) {
    return NextResponse.json({
      error: 'Nao foi possivel preencher o preview.',
      missingFields: rendered.missingVariables.map((variable) => `{{${variable}}}`),
    }, { status: 422 })
  }

  return new NextResponse(rendered.buffer as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="preview-${version.fileName.replace(/["\r\n]/g, '')}"`,
    },
  })
}

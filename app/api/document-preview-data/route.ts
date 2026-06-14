import { forbiddenResponse, membershipWhere } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const companyId = new URL(req.url).searchParams.get('companyId')
  if (!companyId || !(await hasCompanyPermission(userId, companyId, 'manageSettings'))) {
    return forbiddenResponse()
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      documentVariables: {
        orderBy: { label: 'asc' },
      },
      developments: {
        where: membershipWhere(userId),
        include: {
          contractSettings: true,
          documentValues: {
            include: { variable: true },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  })
  if (!company) return forbiddenResponse()

  return NextResponse.json({
    company: {
      id: company.id,
      name: company.name,
      customValues: Object.fromEntries(
        company.documentVariables.map((variable) => [
          `custom.${variable.key}`,
          variable.defaultValue || '',
        ]),
      ),
    },
    developments: company.developments.map((development) => {
      const settings = development.contractSettings
      return {
        id: development.id,
        name: development.name,
        values: {
          'empresa.nome': company.name,
          'empreendimento.nome': development.name,
          'empreendimento.descricao': settings?.propertyDescription || '',
          'empreendimento.origem_imovel': settings?.acquisitionDescription || '',
          'vendedor.nome': settings?.sellerName || company.name,
          'vendedor.documento': settings?.sellerDocument || '',
          'vendedor.endereco': settings?.sellerAddress || '',
          'vendedor.representantes': settings?.sellerRepresentatives || '',
          'vendedor.instrucoes_pagamento': settings?.paymentInstructions || '',
          'vendedor.foro': settings?.jurisdiction || '',
          'vendedor.clausulas_adicionais': settings?.additionalClauses || '',
          ...Object.fromEntries(
            company.documentVariables.map((variable) => [
              `custom.${variable.key}`,
              development.documentValues.find((item) => item.variableId === variable.id)?.value ||
                variable.defaultValue ||
                '',
            ]),
          ),
        },
      }
    }),
  })
}

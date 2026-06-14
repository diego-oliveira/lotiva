import { documentTemplateAccessWhere, forbiddenResponse, membershipWhere } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { getTemplateVariables } from '@/lib/document-templates'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

const settingFields: Record<string, string> = {
  'empreendimento.descricao': 'propertyDescription',
  'empreendimento.origem_imovel': 'acquisitionDescription',
  'vendedor.nome': 'sellerName',
  'vendedor.documento': 'sellerDocument',
  'vendedor.endereco': 'sellerAddress',
  'vendedor.representantes': 'sellerRepresentatives',
  'vendedor.instrucoes_pagamento': 'paymentInstructions',
  'vendedor.foro': 'jurisdiction',
  'vendedor.clausulas_adicionais': 'additionalClauses',
}

const settingLabels: Record<string, string> = {
  'empreendimento.descricao': 'Descricao do empreendimento',
  'empreendimento.origem_imovel': 'Origem e regularidade do imovel',
  'vendedor.nome': 'Nome ou razao social do vendedor',
  'vendedor.documento': 'CPF ou CNPJ do vendedor',
  'vendedor.endereco': 'Endereco do vendedor',
  'vendedor.representantes': 'Representantes do vendedor',
  'vendedor.instrucoes_pagamento': 'Instrucoes de pagamento',
  'vendedor.foro': 'Foro',
  'vendedor.clausulas_adicionais': 'Clausulas adicionais',
}

const optionalSettingVariables = new Set([
  'vendedor.representantes',
  'vendedor.clausulas_adicionais',
])

async function getTemplate(userId: string, id: string) {
  return prisma.documentTemplate.findFirst({
    where: { id, ...documentTemplateAccessWhere(userId) },
    include: {
      versions: {
        where: { status: 'published' },
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  })
}

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params
  const template = await getTemplate(userId, id)
  if (!template || !(await hasCompanyPermission(userId, template.companyId, 'manageSettings'))) {
    return forbiddenResponse()
  }
  const published = template.versions[0]
  if (!published) {
    return NextResponse.json({ error: 'Publique o modelo antes de configurar o uso.' }, { status: 400 })
  }

  const variables = getTemplateVariables(published.content)
  const configurableVariables = [...new Set(variables.filter((variable) => settingFields[variable]))]
  const customKeys = [...new Set(
    variables.filter((variable) => variable.startsWith('custom.')).map((variable) => variable.slice(7)),
  )]
  const [customVariables, developments] = await Promise.all([
    prisma.documentVariable.findMany({
      where: { companyId: template.companyId, key: { in: customKeys } },
      orderBy: { label: 'asc' },
    }),
    prisma.development.findMany({
      where: {
        companyId: template.companyId,
        ...membershipWhere(userId),
      },
      include: {
        contractSettings: true,
        documentValues: {
          where: { variable: { key: { in: customKeys } } },
          include: { variable: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json({
    template: { id: template.id, name: template.name, version: published.version },
    fields: [
      ...configurableVariables.map((variable) => ({
        variable,
        label: settingLabels[variable],
        type: variable.includes('descricao') || variable.includes('origem') || variable.includes('instrucoes') || variable.includes('clausulas') ? 'textarea' : 'text',
        required: !optionalSettingVariables.has(variable),
      })),
      ...customVariables.map((variable) => ({
        variable: `custom.${variable.key}`,
        label: variable.label,
        type: variable.type,
        required: variable.required,
        defaultValue: variable.defaultValue,
      })),
    ],
    developments: developments.map((development) => {
      const settings = development.contractSettings as Record<string, unknown> | null
      const values: Record<string, string> = {}
      configurableVariables.forEach((variable) => {
        values[variable] = String(settings?.[settingFields[variable]] ?? '')
      })
      customVariables.forEach((variable) => {
        const override = development.documentValues.find((item) => item.variableId === variable.id)
        values[`custom.${variable.key}`] = override?.value || variable.defaultValue || ''
      })
      return {
        id: development.id,
        name: development.name,
        selected: development.documentTemplateId === template.id,
        values,
      }
    }),
  })
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params
  const template = await getTemplate(userId, id)
  if (!template || !(await hasCompanyPermission(userId, template.companyId, 'manageSettings'))) {
    return forbiddenResponse()
  }
  if (!template.versions[0] || template.purpose !== 'sale_contract') {
    return NextResponse.json({ error: 'Somente contratos de venda publicados podem ser ativados.' }, { status: 400 })
  }

  const data = await req.json()
  const selectedIds = Array.isArray(data.developmentIds) ? data.developmentIds : []
  const developments = await prisma.development.findMany({
    where: {
      id: { in: selectedIds },
      companyId: template.companyId,
      ...membershipWhere(userId),
    },
    select: { id: true },
  })
  if (developments.length !== selectedIds.length) return forbiddenResponse()

  const variables = getTemplateVariables(template.versions[0].content)
  const configurableVariables = [...new Set(variables.filter((variable) => settingFields[variable]))]
  const customKeys = [...new Set(
    variables.filter((variable) => variable.startsWith('custom.')).map((variable) => variable.slice(7)),
  )]
  const customVariables = await prisma.documentVariable.findMany({
    where: { companyId: template.companyId, key: { in: customKeys } },
  })
  const configs = data.configurations && typeof data.configurations === 'object' ? data.configurations : {}

  for (const developmentId of selectedIds) {
    const values = configs[developmentId] && typeof configs[developmentId] === 'object'
      ? configs[developmentId]
      : {}
    const missing = [
      ...configurableVariables.filter(
        (variable) => !optionalSettingVariables.has(variable) && !String(values[variable] || '').trim(),
      ),
      ...customVariables
        .filter((variable) => variable.required && !String(values[`custom.${variable.key}`] || variable.defaultValue || '').trim())
        .map((variable) => `custom.${variable.key}`),
    ]
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Preencha os campos obrigatorios antes de ativar.', developmentId, missingFields: missing },
        { status: 400 },
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.development.updateMany({
      where: { documentTemplateId: id, id: { notIn: selectedIds } },
      data: { documentTemplateId: null },
    })
    for (const developmentId of selectedIds) {
      const values = configs[developmentId] ?? {}
      await tx.development.update({
        where: { id: developmentId },
        data: { documentTemplateId: id },
      })
      const settingsData = Object.fromEntries(
        configurableVariables.map((variable) => [settingFields[variable], String(values[variable] || '')]),
      )
      await tx.developmentContractSettings.upsert({
        where: { developmentId },
        create: { developmentId, ...settingsData },
        update: settingsData,
      })
      for (const variable of customVariables) {
        const value = String(values[`custom.${variable.key}`] || '').trim()
        if (!value || value === String(variable.defaultValue || '').trim()) {
          await tx.developmentDocumentValue.deleteMany({
            where: { developmentId, variableId: variable.id },
          })
        } else {
          await tx.developmentDocumentValue.upsert({
            where: {
              developmentId_variableId: { developmentId, variableId: variable.id },
            },
            create: { developmentId, variableId: variable.id, value },
            update: { value },
          })
        }
      }
    }
  })

  return NextResponse.json({ configured: true, developmentCount: selectedIds.length })
}

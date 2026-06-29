import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, membershipWhere } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { isValidUploadedImagePath } from '@/lib/uploadStorage'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

function normalizeSettings(settings: any = {}) {
  const paymentMethods = Array.isArray(settings.paymentMethods)
    ? settings.paymentMethods.join(',')
    : settings.paymentMethods || 'cash,installments'

  return {
    reservationValidityDays: Number(settings.reservationValidityDays) || 7,
    defaultInterestRate: Number(settings.defaultInterestRate) || 0,
    interestCalculation: settings.interestCalculation || 'none',
    correctionIndex: settings.correctionIndex || 'none',
    correctionFrequency: settings.correctionFrequency || 'monthly',
    minDownPaymentPercentage: Number(settings.minDownPaymentPercentage) || 10,
    maxInstallments: Number(settings.maxInstallments) || 120,
    paymentMethods,
    allowCustomTerms: settings.allowCustomTerms !== false,
  }
}

function normalizeContractSettings(contractSettings: any = {}) {
  return {
    sellerName: String(contractSettings.sellerName || ''),
    sellerDocument: String(contractSettings.sellerDocument || ''),
    sellerAddress: String(contractSettings.sellerAddress || ''),
    sellerRepresentatives: String(contractSettings.sellerRepresentatives || ''),
    propertyDescription: String(contractSettings.propertyDescription || ''),
    acquisitionDescription: String(contractSettings.acquisitionDescription || ''),
    paymentInstructions: String(contractSettings.paymentInstructions || ''),
    jurisdiction: String(contractSettings.jurisdiction || ''),
    additionalClauses: String(contractSettings.additionalClauses || ''),
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params

  const development = await prisma.development.findFirst({
    where: {
      id,
      ...membershipWhere(userId),
    },
    include: {
      company: true,
      settings: true,
      contractSettings: true,
      map: true,
      documentTemplate: true,
      _count: {
        select: {
          blocks: true,
        },
      },
    },
  })

  if (!development) {
    return NextResponse.json({ error: 'Development not found' }, { status: 404 })
  }

  return NextResponse.json(development)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params
  const data = await req.json()
  const logo = String(data.logo || '').trim()
  if (logo && !isValidUploadedImagePath(logo)) {
    return NextResponse.json({ error: 'Envie uma imagem valida para o logo.' }, { status: 400 })
  }
  if (!String(data.name || '').trim()) {
    return NextResponse.json({ error: 'Informe o nome do empreendimento.' }, { status: 400 })
  }

  const canAccessDevelopment = await prisma.development.count({
    where: {
      id,
      ...membershipWhere(userId),
    },
  })
  if (!canAccessDevelopment) return forbiddenResponse()

  const documentTemplateId = String(data.documentTemplateId || '').trim()
  if (documentTemplateId) {
    const template = await prisma.documentTemplate.findFirst({
      where: {
        id: documentTemplateId,
        companyId: data.companyId,
        purpose: 'sale_contract',
        status: 'published',
        versions: { some: { status: 'published' } },
      },
      select: { id: true },
    })
    if (!template) {
      return NextResponse.json({ error: 'Selecione um modelo publicado da mesma empresa.' }, { status: 400 })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const development = await tx.development.update({
      where: { id },
      data: {
        name: String(data.name).trim(),
        logo,
        companyId: data.companyId,
        documentTemplateId: documentTemplateId || null,
        updatedAt: new Date(),
      },
    })

    if (data.settings) {
      await tx.developmentSettings.upsert({
        where: { developmentId: id },
        create: {
          developmentId: id,
          ...normalizeSettings(data.settings),
        },
        update: normalizeSettings(data.settings),
      })
    }

    if (data.contractSettings) {
      await tx.developmentContractSettings.upsert({
        where: { developmentId: id },
        create: {
          developmentId: id,
          ...normalizeContractSettings(data.contractSettings),
        },
        update: normalizeContractSettings(data.contractSettings),
      })
    }

    return development
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params
  const canManageSettings = await hasDevelopmentPermission(userId, id, 'manageSettings')
  if (!canManageSettings) return forbiddenResponse()

  const data = await req.json().catch(() => ({}))
  const confirmationName = String(data.confirmationName || '').trim()

  const development = await prisma.development.findFirst({
    where: {
      id,
      ...membershipWhere(userId),
    },
    select: { id: true, name: true, deletedAt: true },
  })
  if (!development) {
    return NextResponse.json({ error: 'Empreendimento nao encontrado.' }, { status: 404 })
  }
  if (confirmationName !== development.name) {
    return NextResponse.json({ error: 'Digite o nome exato do empreendimento para confirmar a exclusao.' }, { status: 400 })
  }

  const deleted = await prisma.development.update({
    where: { id },
    data: { deletedAt: new Date() },
  })

  return NextResponse.json(deleted)
}

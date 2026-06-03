import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, membershipWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'

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

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const developments = await prisma.development.findMany({
    where: membershipWhere(userId),
    include: {
      company: true,
      settings: true,
      contractSettings: true,
      _count: {
        select: {
          blocks: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(developments)
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const data = await req.json()

  const company = await prisma.company.findUnique({
    where: { id: data.companyId },
    select: { id: true },
  })
  if (!company) return forbiddenResponse()

  const development = await prisma.development.create({
    data: {
      name: data.name,
      logo: data.logo,
        companyId: data.companyId,
        settings: {
          create: normalizeSettings(data.settings),
        },
        contractSettings: {
          create: normalizeContractSettings(data.contractSettings),
        },
        memberships: {
          create: {
            userId,
          roles: {
            create: {
              role: {
                connectOrCreate: {
                  where: { name: 'Administrador' },
                  create: { name: 'Administrador' },
                },
              },
            },
          },
        },
      },
    },
  })

  return NextResponse.json(development, { status: 201 })
}

import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, membershipWhere } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

const paymentMethodKeys = ['cash', 'installments', 'financing', 'bank_slip', 'pix'] as const
const interestCalculations = new Set(['none', 'simple', 'compound'])
const correctionIndexes = new Set(['none', 'ipca', 'incc', 'igpm', 'fixed'])
const correctionFrequencies = new Set(['monthly', 'annual'])

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePaymentMethods(value: unknown) {
  if (!Array.isArray(value)) return null

  const methods = value
    .map((method) => String(method))
    .filter((method) => paymentMethodKeys.includes(method as (typeof paymentMethodKeys)[number]))

  return [...new Set(methods)]
}

async function canAccessDevelopment(userId: string, developmentId: string) {
  const development = await prisma.development.findFirst({
    where: {
      id: developmentId,
      ...membershipWhere(userId),
    },
    select: { id: true },
  })

  return Boolean(development)
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params

  const hasAccess = await canAccessDevelopment(userId, id)
  if (!hasAccess) return forbiddenResponse()

  const settings = await prisma.developmentSettings.upsert({
    where: { developmentId: id },
    update: {},
    create: { developmentId: id },
  })

  return NextResponse.json({
    ...settings,
    paymentMethods: settings.paymentMethods.split(',').filter(Boolean),
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params
  const data = await req.json()

  const canManageSettings = await hasDevelopmentPermission(userId, id, 'manageSettings')
  if (!canManageSettings) return forbiddenResponse()

  const errors: Record<string, string> = {}
  const reservationValidityDays = asNumber(data.reservationValidityDays)
  const defaultInterestRate = asNumber(data.defaultInterestRate)
  const minDownPaymentPercentage = asNumber(data.minDownPaymentPercentage)
  const maxInstallments = asNumber(data.maxInstallments)
  const paymentMethods = normalizePaymentMethods(data.paymentMethods)

  if (!reservationValidityDays || reservationValidityDays < 1 || reservationValidityDays > 180) {
    errors.reservationValidityDays = 'Informe um prazo entre 1 e 180 dias.'
  }

  if (defaultInterestRate === null || defaultInterestRate < 0 || defaultInterestRate > 10) {
    errors.defaultInterestRate = 'Informe juros entre 0% e 10% ao mes.'
  }

  if (!interestCalculations.has(data.interestCalculation)) {
    errors.interestCalculation = 'Selecione um tipo de juros valido.'
  }

  if (!correctionIndexes.has(data.correctionIndex)) {
    errors.correctionIndex = 'Selecione um indice de correcao valido.'
  }

  if (!correctionFrequencies.has(data.correctionFrequency)) {
    errors.correctionFrequency = 'Selecione uma periodicidade valida.'
  }

  if (minDownPaymentPercentage === null || minDownPaymentPercentage < 0 || minDownPaymentPercentage > 100) {
    errors.minDownPaymentPercentage = 'Informe entrada minima entre 0% e 100%.'
  }

  if (!maxInstallments || maxInstallments < 1 || maxInstallments > 240) {
    errors.maxInstallments = 'Informe ate 240 parcelas.'
  }

  if (!paymentMethods?.length) {
    errors.paymentMethods = 'Selecione pelo menos uma forma de pagamento.'
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 })
  }

  const settings = await prisma.developmentSettings.upsert({
    where: { developmentId: id },
    update: {
      reservationValidityDays: Math.round(reservationValidityDays!),
      defaultInterestRate: defaultInterestRate!,
      interestCalculation: data.interestCalculation,
      correctionIndex: data.correctionIndex,
      correctionFrequency: data.correctionFrequency,
      minDownPaymentPercentage: minDownPaymentPercentage!,
      maxInstallments: Math.round(maxInstallments!),
      paymentMethods: paymentMethods!.join(','),
      allowCustomTerms: Boolean(data.allowCustomTerms),
    },
    create: {
      developmentId: id,
      reservationValidityDays: Math.round(reservationValidityDays!),
      defaultInterestRate: defaultInterestRate!,
      interestCalculation: data.interestCalculation,
      correctionIndex: data.correctionIndex,
      correctionFrequency: data.correctionFrequency,
      minDownPaymentPercentage: minDownPaymentPercentage!,
      maxInstallments: Math.round(maxInstallments!),
      paymentMethods: paymentMethods!.join(','),
      allowCustomTerms: Boolean(data.allowCustomTerms),
    },
  })

  return NextResponse.json({
    ...settings,
    paymentMethods: settings.paymentMethods.split(',').filter(Boolean),
  })
}

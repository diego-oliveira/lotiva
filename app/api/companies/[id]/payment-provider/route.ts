import { companyAccessWhere, forbiddenResponse } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { AsaasPaymentProvider, normalizeAsaasApiKey } from '@/lib/payments/asaas-provider'
import { encryptPaymentCredential } from '@/lib/payments/credentials'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

async function getCompany(userId: string, companyId: string) {
  return prisma.company.findFirst({
    where: { id: companyId, ...companyAccessWhere(userId) },
    select: { id: true },
  })
}

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const userId = auth.session.user.id

  if (!(await getCompany(userId, id)) || !(await hasCompanyPermission(userId, id, 'manageSettings'))) {
    return forbiddenResponse()
  }

  const connections = await prisma.paymentProviderConnection.findMany({
    where: { companyId: id },
    select: {
      id: true,
      provider: true,
      environment: true,
      status: true,
      credentialHint: true,
      lastValidatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ provider: 'asc' }, { environment: 'asc' }],
  })

  return NextResponse.json(connections)
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const userId = auth.session.user.id

  if (!(await getCompany(userId, id)) || !(await hasCompanyPermission(userId, id, 'manageSettings'))) {
    return forbiddenResponse()
  }

  try {
    const data = await req.json()
    const environment = data.environment === 'production' ? 'production' : 'sandbox'
    const apiKey = normalizeAsaasApiKey(String(data.apiKey || ''))
    if (!apiKey) {
      return NextResponse.json({ error: 'Informe a chave da API Asaas.' }, { status: 400 })
    }

    const provider = new AsaasPaymentProvider(apiKey, environment)
    await provider.listCharges({ limit: 1 })

    const connection = await prisma.paymentProviderConnection.upsert({
      where: {
        companyId_provider_environment: {
          companyId: id,
          provider: 'asaas',
          environment,
        },
      },
      create: {
        companyId: id,
        provider: 'asaas',
        environment,
        status: 'active',
        credentialCiphertext: encryptPaymentCredential(apiKey),
        credentialHint: `${apiKey.slice(0, 11)}...${apiKey.slice(-4)}`,
        lastValidatedAt: new Date(),
      },
      update: {
        status: 'active',
        credentialCiphertext: encryptPaymentCredential(apiKey),
        credentialHint: `${apiKey.slice(0, 11)}...${apiKey.slice(-4)}`,
        lastValidatedAt: new Date(),
      },
      select: {
        id: true,
        provider: true,
        environment: true,
        status: true,
        credentialHint: true,
        lastValidatedAt: true,
      },
    })

    return NextResponse.json(connection)
  } catch (error) {
    return NextResponse.json({
      error: 'Nao foi possivel conectar ao Asaas.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 400 })
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const userId = auth.session.user.id

  if (!(await getCompany(userId, id)) || !(await hasCompanyPermission(userId, id, 'manageSettings'))) {
    return forbiddenResponse()
  }

  const data = await req.json().catch(() => ({}))
  const environment = data.environment === 'production' ? 'production' : 'sandbox'
  await prisma.paymentProviderConnection.updateMany({
    where: { companyId: id, provider: 'asaas', environment },
    data: {
      status: 'inactive',
      credentialCiphertext: null,
      credentialHint: null,
    },
  })

  return NextResponse.json({ disconnected: true })
}

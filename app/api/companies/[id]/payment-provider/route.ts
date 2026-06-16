import { companyAccessWhere, forbiddenResponse } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import {
  AsaasPaymentProvider,
  normalizeAsaasApiKey,
  normalizeWebhookEmail,
} from '@/lib/payments/asaas-provider'
import { encryptPaymentCredential } from '@/lib/payments/credentials'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { decryptPaymentCredential } from '@/lib/payments/credentials'
import { createFinancialAuditLog } from '@/lib/payments/audit'

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

  if (!(await getCompany(userId, id)) || !(await hasCompanyPermission(userId, id, 'connectPayments'))) {
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
      webhookUrl: true,
      webhookStatus: true,
      webhookAuthHint: true,
      lastWebhookAt: true,
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

  if (!(await getCompany(userId, id)) || !(await hasCompanyPermission(userId, id, 'connectPayments'))) {
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

    const existing = await prisma.paymentProviderConnection.findUnique({
      where: {
        companyId_provider_environment: {
          companyId: id,
          provider: 'asaas',
          environment,
        },
      },
    })
    const webhookAuthToken = existing?.webhookAuthCiphertext
      ? decryptPaymentCredential(existing.webhookAuthCiphertext)
      : `whsec_${randomBytes(32).toString('base64url')}`

    let connection = await prisma.paymentProviderConnection.upsert({
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
        webhookAuthCiphertext: encryptPaymentCredential(webhookAuthToken),
        webhookAuthHint: `${webhookAuthToken.slice(0, 10)}...${webhookAuthToken.slice(-4)}`,
      },
      update: {
        status: 'active',
        credentialCiphertext: encryptPaymentCredential(apiKey),
        credentialHint: `${apiKey.slice(0, 11)}...${apiKey.slice(-4)}`,
        lastValidatedAt: new Date(),
        webhookAuthCiphertext: encryptPaymentCredential(webhookAuthToken),
        webhookAuthHint: `${webhookAuthToken.slice(0, 10)}...${webhookAuthToken.slice(-4)}`,
      },
      select: {
        id: true,
        provider: true,
        environment: true,
        status: true,
        credentialHint: true,
        lastValidatedAt: true,
        webhookUrl: true,
        webhookStatus: true,
        webhookAuthHint: true,
        lastWebhookAt: true,
      },
    })

    const configuredBaseUrl = (
      process.env.PAYMENT_WEBHOOK_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      process.env.AUTH_URL ||
      ''
    ).replace(/\/$/, '')
    let webhookWarning: string | null = null
    if (configuredBaseUrl && !configuredBaseUrl.includes('localhost')) {
      const webhookUrl = `${configuredBaseUrl}/api/webhooks/asaas/${connection.id}`
      try {
        const webhook = await provider.ensurePaymentWebhook({
          id: existing?.webhookId,
          name: `Lotiva ${environment}`,
          url: webhookUrl,
          email: normalizeWebhookEmail(process.env.SMTP_FROM),
          authToken: webhookAuthToken,
        })
        connection = await prisma.paymentProviderConnection.update({
          where: { id: connection.id },
          data: {
            webhookId: webhook.id,
            webhookUrl,
            webhookStatus: webhook.interrupted
              ? 'interrupted'
              : webhook.enabled
                ? 'active'
                : 'inactive',
          },
          select: {
            id: true,
            provider: true,
            environment: true,
            status: true,
            credentialHint: true,
            lastValidatedAt: true,
            webhookUrl: true,
            webhookStatus: true,
            webhookAuthHint: true,
            lastWebhookAt: true,
          },
        })
      } catch (error) {
        webhookWarning = error instanceof Error ? error.message : 'Falha ao configurar webhook.'
        await prisma.paymentProviderConnection.update({
          where: { id: connection.id },
          data: { webhookStatus: 'configuration_failed' },
        })
      }
    } else {
      await prisma.paymentProviderConnection.update({
        where: { id: connection.id },
        data: { webhookStatus: 'awaiting_public_url' },
      })
      connection = { ...connection, webhookStatus: 'awaiting_public_url' }
    }

    await createFinancialAuditLog(prisma, {
      companyId: id,
      actorId: userId,
      action: existing ? 'payment_connection_updated' : 'payment_connection_created',
      entityType: 'payment_connection',
      entityId: connection.id,
      metadata: { provider: 'asaas', environment, webhookStatus: connection.webhookStatus },
    })

    return NextResponse.json({ ...connection, webhookWarning })
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

  if (!(await getCompany(userId, id)) || !(await hasCompanyPermission(userId, id, 'connectPayments'))) {
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
      webhookStatus: 'inactive',
      webhookAuthCiphertext: null,
      webhookAuthHint: null,
    },
  })

  const connection = await prisma.paymentProviderConnection.findUnique({
    where: {
      companyId_provider_environment: {
        companyId: id,
        provider: 'asaas',
        environment,
      },
    },
    select: { id: true },
  })
  if (connection) {
    await createFinancialAuditLog(prisma, {
      companyId: id,
      actorId: userId,
      action: 'payment_connection_disconnected',
      entityType: 'payment_connection',
      entityId: connection.id,
      metadata: { provider: 'asaas', environment },
    })
  }

  return NextResponse.json({ disconnected: true })
}

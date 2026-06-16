import { PrismaClient } from '../app/generated/prisma'
import {
  AsaasPaymentProvider,
  normalizeWebhookEmail,
} from '../lib/payments/asaas-provider'
import {
  decryptPaymentCredential,
} from '../lib/payments/credentials'

const prisma = new PrismaClient()

async function main() {
  const baseUrl = (
    process.env.PAYMENT_WEBHOOK_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    ''
  ).replace(/\/$/, '')
  if (!baseUrl || baseUrl.includes('localhost')) {
    throw new Error('PAYMENT_WEBHOOK_BASE_URL deve ser uma origem HTTPS publica.')
  }

  const connections = await prisma.paymentProviderConnection.findMany({
    where: {
      provider: 'asaas',
      status: 'active',
      credentialCiphertext: { not: null },
      webhookAuthCiphertext: { not: null },
    },
  })
  if (connections.length === 0) {
    throw new Error('Nenhuma conexao Asaas ativa foi encontrada.')
  }

  for (const connection of connections) {
    try {
      const provider = new AsaasPaymentProvider(
        decryptPaymentCredential(connection.credentialCiphertext!),
        connection.environment === 'production' ? 'production' : 'sandbox',
      )
      const webhookUrl = `${baseUrl}/api/webhooks/asaas/${connection.id}`
      const webhook = await provider.ensurePaymentWebhook({
        id: connection.webhookId,
        name: `Lotiva ${connection.environment}`,
        url: webhookUrl,
        email: normalizeWebhookEmail(process.env.SMTP_FROM),
        authToken: decryptPaymentCredential(connection.webhookAuthCiphertext!),
      })
      await prisma.paymentProviderConnection.update({
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
      })
      console.log(`${connection.environment}: webhook ativo em ${webhookUrl}`)
    } catch (error) {
      await prisma.paymentProviderConnection.update({
        where: { id: connection.id },
        data: { webhookStatus: 'configuration_failed' },
      })
      console.error(
        `${connection.environment}: ${
          error instanceof Error ? error.message : 'falha desconhecida'
        }`,
      )
      process.exitCode = 1
    }
  }
}

main()
  .finally(() => prisma.$disconnect())

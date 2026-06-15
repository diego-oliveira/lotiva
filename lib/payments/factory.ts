import { prisma } from '@/lib/prisma'
import { AsaasPaymentProvider } from './asaas-provider'
import { decryptPaymentCredential } from './credentials'

export async function getPaymentProviderForConnection(connectionId: string) {
  const connection = await prisma.paymentProviderConnection.findUnique({
    where: { id: connectionId },
  })
  if (!connection || connection.status !== 'active' || !connection.credentialCiphertext) {
    throw new Error('A conexao com o provedor de pagamentos nao esta ativa.')
  }

  if (connection.provider === 'asaas') {
    return {
      connection,
      provider: new AsaasPaymentProvider(
        decryptPaymentCredential(connection.credentialCiphertext),
        connection.environment === 'production' ? 'production' : 'sandbox',
      ),
    }
  }

  throw new Error(`Provedor nao suportado: ${connection.provider}`)
}

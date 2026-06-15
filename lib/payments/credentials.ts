import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const algorithm = 'aes-256-gcm'
const version = 'v1'

function getEncryptionKey() {
  const encoded = process.env.PAYMENT_CREDENTIALS_KEY?.trim()
  if (!encoded) {
    throw new Error('PAYMENT_CREDENTIALS_KEY nao esta configurada.')
  }

  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) {
    throw new Error('PAYMENT_CREDENTIALS_KEY deve ser uma chave Base64 de 32 bytes.')
  }
  return key
}

export function encryptPaymentCredential(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    version,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decryptPaymentCredential(payload: string) {
  const [payloadVersion, iv, authTag, encrypted] = payload.split(':')
  if (payloadVersion !== version || !iv || !authTag || !encrypted) {
    throw new Error('Credencial de pagamento possui formato invalido.')
  }

  const decipher = createDecipheriv(
    algorithm,
    getEncryptionKey(),
    Buffer.from(iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(authTag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

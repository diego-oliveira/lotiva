const AUTENTIQUE_ENDPOINT = 'https://api.autentique.com.br/v2/graphql'

export type AutentiqueSignerInput = {
  name: string
  email: string
  action: 'SIGN' | 'SIGN_AS_A_WITNESS'
  role: 'buyer' | 'seller' | 'witness'
}

export type AutentiqueSignerStatus = AutentiqueSignerInput & {
  publicId?: string
  viewedAt?: string | null
  signedAt?: string | null
  rejectedAt?: string | null
}

type GraphqlResponse<T> = {
  data?: T
  errors?: Array<{ message?: string; extensions?: { validation?: Record<string, string[] | string> } }>
}

function getToken() {
  const token = process.env.AUTENTIQUE_API_TOKEN?.trim()
  if (!token) throw new Error('AUTENTIQUE_API_TOKEN nao esta configurado.')
  return token
}

export function getAutentiqueEnvironment() {
  return process.env.AUTENTIQUE_ENVIRONMENT?.trim().toLowerCase() === 'production'
    ? 'production' as const
    : 'sandbox' as const
}

async function parseResponse<T>(response: Response) {
  const payload = await response.json().catch(() => null) as GraphqlResponse<T> | null
  if (!response.ok || !payload?.data || payload.errors?.length) {
    const messages = payload?.errors?.flatMap((error) => {
      const validation = error.extensions?.validation
      if (validation) {
        return Object.entries(validation).flatMap(([field, value]) => (
          Array.isArray(value) ? value.map((message) => `${field}: ${message}`) : [`${field}: ${value}`]
        ))
      }
      return error.message ? [error.message] : []
    }) ?? []
    throw new Error(messages.join('; ') || 'A Autentique recusou a solicitacao.')
  }
  return payload.data
}

export async function createAutentiqueDocument(input: {
  name: string
  pdf: Buffer
  signers: AutentiqueSignerInput[]
}) {
  const sandbox = getAutentiqueEnvironment() === 'sandbox'
  const query = `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
    createDocument(sandbox: ${sandbox}, document: $document, signers: $signers, file: $file) {
      id name created_at sandbox
      signatures { public_id name email action { name } viewed { created_at } signed { created_at } rejected { created_at } }
    }
  }`
  const form = new FormData()
  form.append('operations', JSON.stringify({
    query,
    variables: {
      document: {
        name: input.name,
        refusable: true,
        stop_on_rejected: true,
        configs: { notification_finished: true, notification_signed: true },
      },
      signers: input.signers.map(({ email, action }) => ({ email, action })),
      file: null,
    },
  }))
  form.append('map', JSON.stringify({ file: ['variables.file'] }))
  form.append('file', new Blob([new Uint8Array(input.pdf)], { type: 'application/pdf' }), `${input.name}.pdf`)

  const response = await fetch(AUTENTIQUE_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  })
  const data = await parseResponse<{ createDocument: { id: string; sandbox?: boolean; signatures: Array<any> } }>(response)
  return data.createDocument
}

export async function getAutentiqueDocument(documentId: string) {
  const query = `query GetDocument($id: UUID!) {
    document(id: $id) {
      id name sandbox
      files { original signed pades }
      signatures { public_id name email action { name } viewed { created_at } signed { created_at } rejected { created_at } }
    }
  }`
  const response = await fetch(AUTENTIQUE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { id: documentId } }),
  })
  const data = await parseResponse<{ document: any }>(response)
  return data.document
}

export function mergeAutentiqueSignerStatus(
  configured: AutentiqueSignerInput[],
  remote: Array<any>,
): AutentiqueSignerStatus[] {
  return configured.map((signer) => {
    const signature = remote.find((item) => item.email?.toLowerCase() === signer.email.toLowerCase())
    return {
      ...signer,
      publicId: signature?.public_id,
      viewedAt: signature?.viewed?.created_at ?? null,
      signedAt: signature?.signed?.created_at ?? null,
      rejectedAt: signature?.rejected?.created_at ?? null,
    }
  })
}

export function deriveAutentiqueStatus(signers: AutentiqueSignerStatus[]) {
  if (signers.some((signer) => signer.rejectedAt)) return 'rejected'
  if (signers.length > 0 && signers.every((signer) => signer.signedAt)) return 'signed'
  if (signers.some((signer) => signer.signedAt)) return 'partially_signed'
  return 'pending'
}

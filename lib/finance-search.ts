import type { Prisma } from '@/app/generated/prisma'

export function financeSearchFilter(value: string): Prisma.ReceivableWhereInput {
  const search = value.trim()
  if (!search) return {}

  const containsInsensitive = { contains: search, mode: 'insensitive' as const }
  const cpfDigits = search.replace(/\D/g, '')
  return {
    OR: [
      { sale: { is: { id: { contains: search } } } },
      { sale: { is: { user: { is: { name: containsInsensitive } } } } },
      { sale: { is: { user: { is: { email: containsInsensitive } } } } },
      // An empty CPF fragment matches every non-null CPF.
      ...(cpfDigits ? [{ sale: { is: { user: { is: { cpf: { contains: cpfDigits } } } } } }] : []),
      { sale: { is: { lot: { is: { identifier: containsInsensitive } } } } },
      { sale: { is: { lot: { is: { block: { is: { identifier: containsInsensitive } } } } } } },
    ],
  }
}

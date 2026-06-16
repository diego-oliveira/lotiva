import type { Prisma, PrismaClient } from '@/app/generated/prisma'

type PaymentDatabase = PrismaClient | Prisma.TransactionClient

export async function createFinancialAuditLog(
  db: PaymentDatabase,
  input: {
    companyId: string
    actorId?: string | null
    action: string
    entityType: string
    entityId: string
    saleId?: string | null
    receivableId?: string | null
    externalChargeId?: string | null
    metadata?: unknown
  },
) {
  return db.financialAuditLog.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      saleId: input.saleId,
      receivableId: input.receivableId,
      externalChargeId: input.externalChargeId,
      metadata: input.metadata === undefined
        ? undefined
        : JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue,
    },
  })
}

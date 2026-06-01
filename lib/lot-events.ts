import type { Prisma, PrismaClient } from '@/app/generated/prisma'

type EventClient = Prisma.TransactionClient | PrismaClient

type CreateLotEventInput = {
  lotId: string
  userId?: string | null
  type: string
  title: string
  description?: string | null
  notes?: string | null
}

export async function createLotEvent(client: EventClient, input: CreateLotEventInput) {
  return client.lotEvent.create({
    data: {
      lotId: input.lotId,
      userId: input.userId || null,
      type: input.type,
      title: input.title,
      description: input.description || null,
      notes: input.notes || null,
    },
  })
}

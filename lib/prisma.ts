import { Prisma, PrismaClient } from '../app/generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Keep the existing HTTP contract: money is serialized as a JSON number even
// though persistence and server-side calculations use Decimal.
Prisma.Decimal.prototype.toJSON = function toJSON(): string {
  // Prisma types declare a string return, but JSON.stringify accepts numbers
  // and this keeps the existing API contract for browser consumers.
  return this.toNumber() as unknown as string
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

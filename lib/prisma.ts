import { Prisma, PrismaClient } from '../app/generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchema: string | undefined
}

// Keep the existing HTTP contract: money is serialized as a JSON number even
// though persistence and server-side calculations use Decimal.
Prisma.Decimal.prototype.toJSON = function toJSON(): string {
  // Prisma types declare a string return, but JSON.stringify accepts numbers
  // and this keeps the existing API contract for browser consumers.
  return this.toNumber() as unknown as string
}

// Next preserves this singleton across schema changes during development.
// Include fields so regenerated clients also pick up additions to existing models.
const cachedPrisma = globalForPrisma.prisma
const schema = JSON.stringify(Prisma.dmmf.datamodel.models.map((model) => [model.name, model.fields.map((field) => [field.name, field.type])]))
export const prisma: PrismaClient = cachedPrisma && globalForPrisma.prismaSchema === schema ? cachedPrisma : new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaSchema = schema
}

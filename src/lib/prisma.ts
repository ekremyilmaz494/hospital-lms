import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // Fail-fast: DATABASE_URL eksikse runtime'da anlaşılmaz hatalar yerine burada çöküyoruz
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      '[Prisma] DATABASE_URL ortam değişkeni tanımlı değil. ' +
      '.env.local dosyasına DATABASE_URL=postgresql://... satırını ekleyin.'
    )
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()
globalForPrisma.prisma = prisma

import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL ortam değişkeni tanımlanmamış. ' +
      'Lütfen .env dosyasında DATABASE_URL değerini ayarlayın. ' +
      'Örnek: DATABASE_URL="postgresql://user:pass@host:5432/dbname"' // secret-scanner-disable-line
    )
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Dev ortaminda hot reload'da yeni connection olusturulmasini onle
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

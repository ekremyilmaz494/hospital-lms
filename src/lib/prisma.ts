import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

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
  const pool = new Pool({
    connectionString,
    max: 10,
    min: 2,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 15000,
    allowExitOnIdle: false,
  })
  // Warm pool: establish initial connections immediately
  pool.connect().then(c => c.release()).catch(() => {})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- duplicate @types/pg versions cause type mismatch
  const adapter = new PrismaPg(pool as any)
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }]
      : [],
  })

  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e: { duration: number; query: string }) => {
      if (e.duration > 200) {
        console.warn(`\x1b[33m[Slow Query ${e.duration}ms]\x1b[0m ${e.query.substring(0, 120)}`)
      }
    })
  }

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()
globalForPrisma.prisma = prisma

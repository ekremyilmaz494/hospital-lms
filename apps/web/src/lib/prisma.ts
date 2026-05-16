import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // Fail-fast: DATABASE_URL eksikse runtime'da anlaşılmaz hatalar yerine burada çöküyoruz.
  // Vercel preview build'inde (VERCEL_ENV=preview, NEXT_PHASE=phase-production-build)
  // env tanımlı olmayabilir — Next.js page data collection module import seviyesinde
  // çalıştığı için throw build'i kırıyor. O aşamada stub URL ile devam edilir;
  // gerçek query atılırsa Prisma kendi connection hatasını verir, build sürer.
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
  const isPreview = process.env.VERCEL_ENV === 'preview'
  const connectionString = process.env.DATABASE_URL
    || ((isBuildPhase || isPreview) ? 'postgresql://stub:stub@localhost:5432/stub' : undefined) // secret-scanner-disable-line
  if (!connectionString) {
    throw new Error(
      '[Prisma] DATABASE_URL ortam değişkeni tanımlı değil. ' +
      '.env.local dosyasına DATABASE_URL=postgresql://... satırını ekleyin.'
    )
  }
  const isStubConnection = !process.env.DATABASE_URL
  const isDev = process.env.NODE_ENV === 'development'
  const pool = new Pool({
    connectionString,
    max: 25,
    min: isDev ? 0 : 5,
    idleTimeoutMillis: isDev ? 30000 : 60000,
    connectionTimeoutMillis: 15000,
    allowExitOnIdle: isDev,
  })
  // Warm pool: establish initial connections immediately. Stub connection'da atla,
  // build aşamasında gereksiz hata logu çıkmasın.
  if (!isStubConnection) {
    pool.connect().then(c => c.release()).catch(() => {})
  }
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

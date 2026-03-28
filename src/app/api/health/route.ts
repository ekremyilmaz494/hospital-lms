import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

const APP_VERSION = process.env.npm_package_version ?? '0.1.0'

export async function GET() {
  let dbOk = false
  let redisOk = false

  // ── DB check ──
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch (err) {
    logger.error('health', 'Veritabanı bağlantı hatası', err)
  }

  // ── Redis check ──
  try {
    const redis = getRedis()
    if (redis) {
      const testKey = 'health:ping'
      await redis.set(testKey, 'pong', { ex: 10 })
      const val = await redis.get<string>(testKey)
      redisOk = val === 'pong'
    } else {
      // Redis yapılandırılmamış — in-memory fallback aktif, degraded sayılır
      redisOk = false
    }
  } catch (err) {
    logger.error('health', 'Redis bağlantı hatası', err)
  }

  const status = dbOk && redisOk ? 'ok' : dbOk ? 'degraded' : 'down'
  const httpStatus = status === 'down' ? 503 : 200

  return NextResponse.json(
    {
      status,
      services: { db: dbOk, redis: redisOk },
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    },
    { status: httpStatus },
  )
}

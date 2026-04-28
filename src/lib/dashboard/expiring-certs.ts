/**
 * Admin dashboard "yaklaşan süresi dolan sertifikalar" listesi —
 * hem /api/admin/dashboard/certs hem /api/admin/dashboard/combined
 * bu tek fonksiyonu çağırır, böylece aynı cache key'i güvenle paylaşabilirler.
 *
 * Bug geçmişi: daha önce iki route aynı cache key'i farklı filtre ile
 * yazıyordu (certs revoked dahil, combined revoked hariç). Hangisi cache'i
 * önce doldurursa diğeri onun verisini okuyordu. Artık tek kaynak.
 */
import { prisma } from '@/lib/prisma'
import { getCached, setCached } from '@/lib/redis'
import { getDeadlineStatus } from '@/lib/deadline-status'
import { MS_PER_DAY } from '@/lib/certificate-status'

const LOOKAHEAD_DAYS = 60
const CACHE_TTL = 300

export interface ExpiringCert {
  name: string
  cert: string
  expiryDate: string
  daysLeft: number
  status: 'ok' | 'warning' | 'critical' | 'overdue'
}

export interface ExpiringCertsPayload {
  expiringCerts: ExpiringCert[]
}

export async function fetchExpiringCerts(orgId: string): Promise<ExpiringCertsPayload> {
  const cacheKey = `dashboard:certs:${orgId}`
  const cached = await getCached<ExpiringCertsPayload>(cacheKey)
  if (cached) return cached

  const now = new Date()
  const lookaheadEnd = new Date(now.getTime() + LOOKAHEAD_DAYS * MS_PER_DAY)

  const rows = await prisma.certificate.findMany({
    where: {
      training: { organizationId: orgId },
      expiresAt: { gte: now, lte: lookaheadEnd },
      revokedAt: null, // iptal edilmişler "yaklaşıyor" listesinde çıkmamalı
    },
    select: {
      expiresAt: true,
      user: { select: { firstName: true, lastName: true } },
      training: { select: { title: true } },
    },
    orderBy: { expiresAt: 'asc' },
    take: 10,
  })

  const expiringCerts = rows.map(c => {
    const { status, daysLeft } = getDeadlineStatus(c.expiresAt, {}, now)
    return {
      name: `${c.user.firstName} ${c.user.lastName}`,
      cert: c.training.title,
      expiryDate: new Date(c.expiresAt!).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      daysLeft: daysLeft ?? 0,
      status,
    }
  })

  const payload: ExpiringCertsPayload = { expiringCerts }
  await setCached(cacheKey, payload, CACHE_TTL)
  return payload
}

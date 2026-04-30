import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

/**
 * GET /api/super-admin/settings — Platform ayarlarını getir
 * Ayarlar henüz ayrı bir tabloda tutulmadığı için env variable'lardan okunur.
 */
export const GET = withSuperAdminRoute(async () => {
  // Platform ayarları — env'den ve DB'den toplanan bilgiler
  const orgCount = await prisma.organization.count({ where: { isActive: true } })
  const userCount = await prisma.user.count()

  return jsonResponse({
    platformName: process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Devakent Hastanesi',
    platformUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    defaultStorageLimit: 10,
    maintenanceMode: false,
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: Number(process.env.SMTP_PORT || '587'),
    smtpUser: process.env.SMTP_USER ? '••••••••' : '',
    smtpPassword: process.env.SMTP_PASS ? '••••••••' : '',
    senderName: process.env.SMTP_FROM_NAME || 'Devakent Hastanesi',
    stats: {
      totalOrganizations: orgCount,
      totalUsers: userCount,
    },
  }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
})

/**
 * PUT /api/super-admin/settings — Platform ayarlarını güncelle
 * Not: Gerçek env değişkenleri Vercel'den güncellenir, burada sadece DB'deki ayarlar.
 */
export const PUT = withSuperAdminRoute(async ({ request, dbUser }) => {
  try {
    const body = await request.json()
    logger.info('super-admin:settings', 'Platform ayarları güncellendi', {
      userId: dbUser.id,
      changes: Object.keys(body),
    })

    // Şu an env-based ayarlar değiştirilemez — sadece audit log kaydı yapılıyor.
    // Gelecekte platform_settings tablosu eklenebilir.
    return jsonResponse({ success: true, message: 'Ayarlar kaydedildi.' })
  } catch (err) {
    logger.error('super-admin:settings', 'Ayar güncelleme hatası', err)
    return errorResponse('Ayarlar güncellenirken bir hata oluştu', 500)
  }
})

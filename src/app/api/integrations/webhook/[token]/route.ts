import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseBody } from '@/lib/api-helpers'
import { syncStaffFromHis, syncDepartmentsFromHis } from '@/lib/his-integration'
import { hisWebhookSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

/**
 * POST /api/integrations/webhook/[token]
 *
 * HIS'den gelen push bildirimleri için public webhook endpoint.
 * Kimlik doğrulama: token IS auth (64 hex char).
 * Session/cookie gerekmez.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  // Regex pre-check — DB'ye gitmeden geçersiz tokenları reddet
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const integration = await prisma.hisIntegration.findUnique({
    where: { webhookToken: token },
    include: {
      organization: {
        select: { isActive: true, isSuspended: true },
      },
    },
  })

  if (!integration || !integration.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!integration.organization.isActive || integration.organization.isSuspended) {
    return NextResponse.json({ error: 'Organization suspended' }, { status: 403 })
  }

  const body = await parseBody<unknown>(request)
  if (!body) {
    return NextResponse.json({ error: 'Geçersiz istek verisi' }, { status: 400 })
  }

  const parsed = hisWebhookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz webhook verisi' }, { status: 400 })
  }

  const { event } = parsed.data

  // Event tipine göre uygun sync'i tetikle
  try {
    if (event === 'staff.created' || event === 'staff.updated' || event === 'staff.deactivated') {
      await syncStaffFromHis(integration)
    } else if (event === 'department.created' || event === 'department.updated') {
      await syncDepartmentsFromHis(integration)
    } else {
      // Bilinmeyen event — logla ama hata döndürme (idempotent)
      logger.error('HIS Webhook', `Bilinmeyen event tipi: ${event}`, {
        integrationId: integration.id,
      })
    }
  } catch (err) {
    logger.error('HIS Webhook', 'Sync başarısız', {
      integrationId: integration.id,
      event,
      err: err instanceof Error ? err.message : err,
    })
    return NextResponse.json({ error: 'Sync başarısız' }, { status: 500 })
  }

  return NextResponse.json({ success: true, event })
}

import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import {
  getAuthUserStrict, requireRole, jsonResponse, errorResponse,
  parseBody, createAuditLog,
} from '@/lib/api-helpers'
import { encrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import { hisIntegrationSchema } from '@/lib/validations'

/** GET /api/admin/integrations/his — Entegrasyon ayarlarını döndür (credentials masked) */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const integration = await prisma.hisIntegration.findFirst({
    where: { organizationId: dbUser!.organizationId! },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      authType: true,
      isActive: true,
      lastSyncAt: true,
      syncInterval: true,
      fieldMapping: true,
      webhookToken: true,
      createdAt: true,
      updatedAt: true,
      // credentials intentionally excluded
    },
  })

  if (!integration) return jsonResponse({ integration: null })

  const { webhookToken, ...rest } = integration
  return jsonResponse({
    integration: { ...rest, hasWebhookToken: Boolean(webhookToken) },
  })
}

/** POST /api/admin/integrations/his — Entegrasyonu oluştur veya güncelle */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = hisIntegrationSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join(', ')
    return errorResponse(msg)
  }

  const { credentials, ...rest } = parsed.data

  // Şifreleme başarısızlığını yakala — orphan kayıt oluşmasını önle
  let encryptedCredentials: { v: string }
  try {
    encryptedCredentials = { v: encrypt(JSON.stringify(credentials)) }
  } catch (encErr) {
    logger.error('HIS Integration', 'Kimlik bilgisi şifreleme hatası', encErr)
    return errorResponse('Kimlik bilgileri şifrelenirken bir hata oluştu. Lütfen tekrar deneyin.', 500)
  }

  const existing = await prisma.hisIntegration.findFirst({
    where: { organizationId: dbUser!.organizationId! },
    select: { id: true, webhookToken: true },
  })

  let integration
  if (existing) {
    integration = await prisma.hisIntegration.update({
      where: { id: existing.id },
      data: {
        ...rest,
        credentials: encryptedCredentials,
        // webhookToken değişmez — mevcut HIS bağlantıları bozulmasın
      },
    })
  } else {
    const webhookToken = crypto.randomBytes(32).toString('hex')
    integration = await prisma.hisIntegration.create({
      data: {
        ...rest,
        organizationId: dbUser!.organizationId!,
        credentials: encryptedCredentials,
        webhookToken,
      },
    })
  }

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: existing ? 'update' : 'create',
    entityType: 'HisIntegration',
    entityId: integration.id,
    newData: { ...integration, credentials: '[ENCRYPTED]' },
    request,
  })

  // Dönen objeden credentials ve webhookToken'ı çıkar — ikisi de secret
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { credentials: _creds, webhookToken: _token, ...safeIntegration } = integration

  return jsonResponse({
    integration: { ...safeIntegration, hasWebhookToken: Boolean(_token) },
  })
}

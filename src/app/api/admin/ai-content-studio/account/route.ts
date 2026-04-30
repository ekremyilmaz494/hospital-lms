/**
 * NotebookLM hesap yönetimi — per-org Google/NotebookLM bağlantısı.
 *
 * GET    → bağlı hesap durumu (email, lastVerifiedAt)
 * POST   → storage_state.json yükle (encrypt + worker'a forward + verify)
 * DELETE → bağlantıyı kaldır (DB row + worker dosyası)
 */
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { encrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import { aiAccountConnectSchema } from '@/lib/ai-content-studio/validations'
import { uploadStorageState, deleteAccount, verifyAccount } from '@/lib/ai-content-studio/notebook-worker'
import { checkRateLimit } from '@/lib/redis'

export const GET = withAdminRoute(async ({ organizationId }) => {
  const account = await prisma.aiNotebookAccount.findUnique({
    where: { organizationId },
    select: {
      googleEmail: true,
      connectedAt: true,
      lastVerifiedAt: true,
      lastUsedAt: true,
    },
  })

  return jsonResponse(
    { connected: !!account, account: account ?? null },
    200,
    { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
  )
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  const allowed = await checkRateLimit(`ai-account-connect:${dbUser.id}`, 5, 3600)
  if (!allowed) return errorResponse('Çok fazla bağlama denemesi. Lütfen bir saat bekleyin.', 429)

  const body = await parseBody<{ storageStateJson: string }>(request)
  const parsed = aiAccountConnectSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz storage_state.', 400)
  }

  const encrypted = encrypt(parsed.data.storageStateJson)

  // Worker'a forward et — verify de yapacak
  try {
    await uploadStorageState({
      orgId: organizationId,
      storageStateJson: parsed.data.storageStateJson,
    })
  } catch (err) {
    logger.error('AI Studio', 'Worker storage_state upload failed', { err: String(err) })
    return errorResponse('Worker servisine ulaşılamıyor veya doğrulama başarısız.', 502)
  }

  // Email çekmek için ayrı verify çağrısı (worker email'i ayrı endpoint'ten döndürüyor)
  let googleEmail: string | undefined
  try {
    const status = await verifyAccount(organizationId)
    if (status.connected) googleEmail = status.googleEmail
  } catch {
    // verify hata verse bile DB'ye yazmaya devam et — kullanıcı sonra retry edebilir
  }

  const now = new Date()
  await prisma.aiNotebookAccount.upsert({
    where: { organizationId },
    create: {
      organizationId,
      storageStateEncrypted: encrypted,
      googleEmail: googleEmail ?? null,
      connectedAt: now,
      lastVerifiedAt: now,
    },
    update: {
      storageStateEncrypted: encrypted,
      googleEmail: googleEmail ?? null,
      lastVerifiedAt: now,
      updatedAt: now,
    },
  })

  return jsonResponse({ connected: true, googleEmail: googleEmail ?? null })
}, { requireOrganization: true })

export const DELETE = withAdminRoute(async ({ organizationId }) => {
  try {
    await deleteAccount(organizationId)
  } catch (err) {
    logger.warn('AI Studio', 'Worker delete failed (continuing with DB cleanup)', { err: String(err) })
  }

  await prisma.aiNotebookAccount.deleteMany({ where: { organizationId } })

  return jsonResponse({ ok: true })
}, { requireOrganization: true })

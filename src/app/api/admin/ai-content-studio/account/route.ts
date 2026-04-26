/**
 * NotebookLM hesap yönetimi — per-org Google/NotebookLM bağlantısı.
 *
 * GET    → bağlı hesap durumu (email, lastVerifiedAt)
 * POST   → storage_state.json yükle (encrypt + worker'a forward + verify)
 * DELETE → bağlantıyı kaldır (DB row + worker dosyası)
 */
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { encrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import { aiAccountConnectSchema } from '@/lib/ai-content-studio/validations'
import { uploadStorageState, deleteAccount, verifyAccount } from '@/lib/ai-content-studio/notebook-worker'
import { checkRateLimit } from '@/lib/redis'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const account = await prisma.aiNotebookAccount.findUnique({
    where: { organizationId: dbUser!.organizationId! },
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
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`ai-account-connect:${dbUser!.id}`, 5, 3600)
  if (!allowed) return errorResponse('Çok fazla bağlama denemesi. Lütfen bir saat bekleyin.', 429)

  const body = await parseBody<{ storageStateJson: string }>(request)
  const parsed = aiAccountConnectSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz storage_state.', 400)
  }

  const orgId = dbUser!.organizationId!
  const encrypted = encrypt(parsed.data.storageStateJson)

  // Worker'a forward et — verify de yapacak
  let verifyResult: Awaited<ReturnType<typeof uploadStorageState>>
  try {
    verifyResult = await uploadStorageState({
      orgId,
      storageStateJson: parsed.data.storageStateJson,
    })
  } catch (err) {
    logger.error('AI Studio', 'Worker storage_state upload failed', { err: String(err) })
    return errorResponse('Worker servisine ulaşılamıyor veya doğrulama başarısız.', 502)
  }

  // Email çekmek için ayrı verify çağrısı (worker email'i ayrı endpoint'ten döndürüyor)
  let googleEmail: string | undefined
  try {
    const status = await verifyAccount(orgId)
    if (status.connected) googleEmail = status.googleEmail
  } catch {
    // verify hata verse bile DB'ye yazmaya devam et — kullanıcı sonra retry edebilir
  }

  const now = new Date()
  await prisma.aiNotebookAccount.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
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
}

export async function DELETE() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  try {
    await deleteAccount(orgId)
  } catch (err) {
    logger.warn('AI Studio', 'Worker delete failed (continuing with DB cleanup)', { err: String(err) })
  }

  await prisma.aiNotebookAccount.deleteMany({ where: { organizationId: orgId } })

  return jsonResponse({ ok: true })
}

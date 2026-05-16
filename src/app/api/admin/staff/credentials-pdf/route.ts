/**
 * Giriş Bilgileri PDF endpoint'i — personel/admin/esas yönetici için ortak.
 *
 * Akış:
 *   1. Admin/Süper Admin yeni kullanıcı (personel/admin/esas yönetici) oluşturur
 *      → server response'unda tcKimlik + tempPassword döner.
 *   2. Frontend bu endpoint'e POST atar (items: [...]) → PDF blob alır.
 *   3. Tarayıcıda dosya indirilir (yazıcıdan basıp elden teslim).
 *
 * Güvenlik:
 *   - withAdminRoute ile korunur (admin/super_admin).
 *   - Super_admin orgId NULL gelir → body'de organizationId zorunlu (yeni hastanenin id'si)
 *   - Admin orgId set'lidir → kendi org'undakilere PDF üretebilir, body'deki orgId yok sayılır
 *   - AuditLog: TC plaintext yazılmaz, sadece hash prefix
 */
import { z } from 'zod/v4'
import { withAdminRoute } from '@/lib/api-handler'
import { ApiError, parseBody } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { isValidTcKimlik } from '@/lib/tc'
import { tcAuditRef } from '@/lib/tc-crypto'
import { buildStaffCredentialsPdf } from '@/lib/pdf/staff-credentials'

const itemSchema = z.object({
  fullName: z.string().min(1).max(220),
  tcKimlik: z.string().refine(isValidTcKimlik, { message: 'Geçersiz TC' }),
  // Boş string'i null gibi kabul et — sentetik email'li satırlarda frontend "" gönderebilir.
  email: z.preprocess(v => (v === '' ? null : v), z.string().email().nullable().optional()),
  tempPassword: z.string().min(6).max(64),
  department: z.string().max(120).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
})

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(500),
  maskMode: z.enum(['full', 'masked']).optional(),
  // Super_admin için zorunlu (kendi orgId'si yok); admin için yok sayılır
  organizationId: z.string().uuid().optional(),
})

export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) throw new ApiError('Geçersiz istek verisi', 400)

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError('Geçersiz personel listesi: ' + parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  const { items, maskMode } = parsed.data

  // Super_admin path: organizationId body'den gelir (kendi org'u yok).
  // Admin path: dbUser.organizationId (body'deki yok sayılır → cross-tenant koruma).
  const targetOrgId = dbUser.role === 'super_admin'
    ? parsed.data.organizationId
    : organizationId

  if (!targetOrgId) {
    throw new ApiError('Bu PDF için bir kurum bağlamı gerekir', 400)
  }

  const org = await prisma.organization.findUnique({
    where: { id: targetOrgId },
    select: { name: true },
  })

  const generatedAt = new Date().toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const pdfBuffer = await buildStaffCredentialsPdf({
    organizationName: org?.name ?? 'Organizasyon',
    generatedAt,
    generatedBy: `${dbUser.firstName} ${dbUser.lastName}`,
    items: items.map(i => ({
      fullName: i.fullName,
      tcKimlik: i.tcKimlik,
      email: i.email ?? null,
      tempPassword: i.tempPassword,
      department: i.department ?? null,
      title: i.title ?? null,
    })),
    maskMode: maskMode ?? 'full',
  })

  // KVKK audit — plaintext TC YAZILMAZ; her satır için sadece hash prefix
  await audit({
    action: 'STAFF_CREDENTIALS_PDF_GENERATED',
    entityType: 'pdf',
    entityId: null,
    newData: {
      itemCount: items.length,
      maskMode: maskMode ?? 'full',
      tcRefs: items.map(i => tcAuditRef(i.tcKimlik)),
    },
  })

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="personel-giris-bilgileri-${Date.now()}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
})

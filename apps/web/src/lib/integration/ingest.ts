/**
 * İK/HBYS personel senkron çekirdeği — plan (diff) + apply.
 *
 * `runSync(records, opts)` tüm kanalların (push/file/pull) ortak giriş noktasıdır:
 *  1. org başına eşzamanlılık kilidi (Redis `SET NX`, dev'de memory fallback),
 *  2. SyncRun başlığı,
 *  3. planSync — org kullanıcılarıyla diff (eşleşme önceliği: externalId → tcHash → email),
 *  4. güvenlik eşiği (snapshot toplu deaktivasyon koruması),
 *  5. koltuk limiti (headroom'u aşan create'ler satır hatası),
 *  6. dryRun ise yalnız plan persist edilir,
 *  7. applySync — create/update/deactivate/reactivate (satır bazlı hata toleransı),
 *  8. SyncRowResult + sayaç persist (payloadMasked KVKK-maskeli, TC ASLA yazılmaz).
 *
 * Güvenlik değişmezleri:
 *  - Rol yükseltme ASLA: role !== 'staff' eşleşmeleri `conflict`.
 *  - Manuel personel (externalId=null) snapshot'ta ASLA deaktive edilmez.
 *  - Cross-org TC/e-posta eşleşmesi `conflict` — manuel çözüm gerekir.
 */
import crypto from 'crypto'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { ApiError } from '@/lib/api-helpers'
import { getRedis } from '@/lib/redis'
import { hashTcKimlik } from '@/lib/tc-crypto'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { generateTempPassword } from '@/lib/passwords'
import { generateSyntheticEmail } from '@/lib/synthetic-email'
import { autoAssignByDepartment } from '@/lib/auto-assign'
import { deactivateStaff } from '@/lib/staff-deactivate'
import { checkSubscriptionLimit } from '@/lib/subscription-guard'
import { isOnPrem } from '@/lib/deployment'
import { maskEmail, maskPhone } from '@/lib/pii-mask'
import { createServiceClient } from '@/lib/supabase/server'
import { matchDepartment } from './staff-row'
import type {
  StaffRecord,
  SyncCounts,
  SyncOptions,
  SyncResult,
  SyncRowActionType,
  SyncRowOutcome,
  SyncRunStatusType,
} from './types'

// ── Eşzamanlılık kilidi ───────────────────────────────────────────────────

const SYNC_LOCK_TTL_SECONDS = 600
const SYNC_LOCK_HELD_MESSAGE = 'Bu kurum için devam eden bir senkron var. Lütfen mevcut koşunun bitmesini bekleyin.'
// Redis yoksa (dev) module-level fallback — tek instance varsayımıyla yeterli.
const memorySyncLocks = new Map<string, number>()

async function acquireSyncLock(organizationId: string): Promise<() => Promise<void>> {
  const key = `sync-lock:${organizationId}`
  const redis = getRedis()
  if (redis) {
    try {
      const acquired = await redis.set(key, '1', { nx: true, ex: SYNC_LOCK_TTL_SECONDS })
      if (acquired !== 'OK') throw new ApiError(SYNC_LOCK_HELD_MESSAGE, 409)
      return async () => {
        try {
          await redis.del(key)
        } catch (err) {
          // TTL zaten düşürür — sadece logla.
          logger.warn('sync-ingest', 'Senkron kilidi bırakılamadı (TTL ile düşecek)', err instanceof Error ? err.message : err)
        }
      }
    } catch (err) {
      if (err instanceof ApiError) throw err
      logger.warn('sync-ingest', 'Redis kilit hatası — memory fallback', err instanceof Error ? err.message : err)
      // düş: memory fallback
    }
  }
  const now = Date.now()
  const heldUntil = memorySyncLocks.get(key)
  if (heldUntil && heldUntil > now) throw new ApiError(SYNC_LOCK_HELD_MESSAGE, 409)
  memorySyncLocks.set(key, now + SYNC_LOCK_TTL_SECONDS * 1000)
  return async () => {
    memorySyncLocks.delete(key)
  }
}

// ── İç tipler ─────────────────────────────────────────────────────────────

const ORG_USER_SELECT = {
  id: true,
  externalId: true,
  tcHash: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  title: true,
  departmentId: true,
  isActive: true,
  role: true,
  hireDate: true,
} as const

interface OrgUserLite {
  id: string
  externalId: string | null
  tcHash: string | null
  email: string
  firstName: string
  lastName: string
  phone: string | null
  title: string | null
  departmentId: string | null
  isActive: boolean
  role: string
  hireDate: Date | null
}

/** update/reactivate'te yazılacak alan farkları (yalnız değişenler). */
interface UserChanges {
  firstName?: string
  lastName?: string
  phone?: string
  title?: string
  email?: string
  departmentId?: string
  hireDate?: string
  /** tcHash/email eşleşmesinde externalId'si null kullanıcıya feed'dekini yaz (backfill) */
  externalId?: string
}

interface PlanRow {
  rowIndex: number
  action: SyncRowActionType
  record: StaffRecord | null
  user: OrgUserLite | null
  externalId: string | null
  userId: string | null
  message: string | null
  changes: UserChanges | null
  /** Çözülmüş departman id'si (create/update) */
  resolvedDepartmentId: string | null
  /** Departman adı eşleşmedi → apply'da auto-create edilecek ad */
  pendingDepartmentName: string | null
}

interface SyncPlan {
  rows: PlanRow[]
  /** Org'daki aktif staff sayısı — güvenlik eşiği tabanı */
  activeStaffCount: number
}

// ── Yardımcılar ───────────────────────────────────────────────────────────

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** ISO/`YYYY-MM-DD` string'ini gün hassasiyetinde karşılaştırma anahtarına indirger. */
function toDayKey(value: string | Date): string | null {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/**
 * Sentetik e-posta — feed e-posta vermediyse. TC varsa mevcut helper deseni;
 * yoksa (org, sicil no) çiftinden deterministik hash (aynı kayıt her koşuda aynı adres).
 */
function syntheticEmailFor(rec: StaffRecord, organizationId: string): string {
  if (rec.tcKimlik) return generateSyntheticEmail(hashTcKimlik(rec.tcKimlik))
  const pseudo = crypto.createHash('sha256').update(`${organizationId}:${rec.externalId ?? ''}`).digest('hex')
  return generateSyntheticEmail(pseudo)
}

/** KVKK: payloadMasked — e-posta/telefon maskeli, TC ASLA yazılmaz (yalnız tcProvided bayrağı). */
function maskPayload(rec: StaffRecord | null): Prisma.InputJsonObject | undefined {
  if (!rec) return undefined
  return {
    externalId: rec.externalId ?? null,
    firstName: rec.firstName,
    lastName: rec.lastName,
    email: rec.email ? maskEmail(rec.email) : null,
    phone: rec.phone ? maskPhone(rec.phone) : null,
    tcProvided: !!rec.tcKimlik,
    departmentName: rec.departmentName ?? null,
    departmentId: rec.departmentId ?? null,
    title: rec.title ?? null,
    hireDate: rec.hireDate ?? null,
    active: rec.active ?? null,
  }
}

function countRows(rows: PlanRow[]): SyncCounts {
  const counts: SyncCounts = {
    totalRows: rows.length,
    createdRows: 0,
    updatedRows: 0,
    deactivatedRows: 0,
    reactivatedRows: 0,
    skippedRows: 0,
    failedRows: 0,
  }
  for (const row of rows) {
    switch (row.action) {
      case 'create': counts.createdRows++; break
      case 'update': counts.updatedRows++; break
      case 'deactivate': counts.deactivatedRows++; break
      case 'reactivate': counts.reactivatedRows++; break
      case 'skip': counts.skippedRows++; break
      // conflict manuel çözüm bekler, uygulanmaz → failed sayacında raporlanır
      case 'conflict':
      case 'error': counts.failedRows++; break
    }
  }
  return counts
}

/**
 * Kalan personel koltuğu. `checkSubscriptionLimit` kapısı (abonelik durumu +
 * limit dolu mu) önce çalışır; sayısal headroom için plan limiti okunur.
 * On-prem'de koltuk sayısı lisans Faz-M'de — kapı kontrolünden sonra sınırsız kabul edilir.
 */
async function computeStaffHeadroom(organizationId: string, plannedCreates: number): Promise<number> {
  if (plannedCreates === 0) return 0
  const gate = await checkSubscriptionLimit(organizationId, 'staff')
  if (gate) return 0
  if (isOnPrem()) return plannedCreates
  const [subscription, currentStaff] = await Promise.all([
    prisma.organizationSubscription.findUnique({
      where: { organizationId },
      select: { plan: { select: { maxStaff: true } } },
    }),
    prisma.user.count({ where: { organizationId, role: 'staff' } }),
  ])
  const maxStaff = subscription?.plan?.maxStaff
  if (!maxStaff) return plannedCreates
  return Math.max(0, maxStaff - currentStaff)
}

// ── planSync (diff) ───────────────────────────────────────────────────────

async function planSync(records: StaffRecord[], opts: SyncOptions): Promise<SyncPlan> {
  const { organizationId } = opts

  const feedTcHashes = Array.from(new Set(
    records.flatMap(r => (r.tcKimlik ? [hashTcKimlik(r.tcKimlik)] : [])),
  ))
  const feedEmails = Array.from(new Set(
    records.flatMap(r => (r.email ? [r.email.toLowerCase()] : [])),
  ))

  const [orgUsers, departments, crossOrgTcRows, crossOrgEmailRows] = await Promise.all([
    prisma.user.findMany({ where: { organizationId }, select: ORG_USER_SELECT }),
    prisma.department.findMany({ where: { organizationId }, select: { id: true, name: true } }),
    feedTcHashes.length > 0
      ? prisma.user.findMany({
          where: { tcHash: { in: feedTcHashes }, organizationId: { not: organizationId } },
          select: { tcHash: true },
        })
      : Promise.resolve([] as Array<{ tcHash: string | null }>),
    feedEmails.length > 0
      ? prisma.user.findMany({
          where: { email: { in: feedEmails }, organizationId: { not: organizationId } },
          select: { email: true },
        })
      : Promise.resolve([] as Array<{ email: string }>),
  ])

  const byExternalId = new Map<string, OrgUserLite>()
  const byTcHash = new Map<string, OrgUserLite>()
  const byEmail = new Map<string, OrgUserLite>()
  for (const u of orgUsers) {
    if (u.externalId) byExternalId.set(u.externalId, u)
    if (u.tcHash) byTcHash.set(u.tcHash, u)
    byEmail.set(u.email.toLowerCase(), u)
  }
  const crossOrgTcSet = new Set(crossOrgTcRows.map(r => r.tcHash).filter((h): h is string => !!h))
  const crossOrgEmailSet = new Set(crossOrgEmailRows.map(r => r.email.toLowerCase()))
  const deptIdSet = new Set(departments.map(d => d.id))

  // Feed-içi duplicate takibi (ilk satır kazanır, sonrakiler conflict)
  const seenExternalIds = new Map<string, number>()
  const seenTcHashes = new Map<string, number>()
  const seenEmails = new Map<string, number>()
  // Aynı kullanıcıya birden çok satır eşleşmesin (örn. satır1 externalId, satır2 email ile)
  const claimedUsers = new Map<string, number>()

  const rows: PlanRow[] = []

  records.forEach((rec, rowIndex) => {
    const externalId = rec.externalId ?? null
    const tcHash = rec.tcKimlik ? hashTcKimlik(rec.tcKimlik) : null
    const email = rec.email ? rec.email.toLowerCase() : null

    const row: PlanRow = {
      rowIndex,
      action: 'skip',
      record: rec,
      user: null,
      externalId,
      userId: null,
      message: null,
      changes: null,
      resolvedDepartmentId: null,
      pendingDepartmentName: null,
    }
    rows.push(row)

    const fail = (action: SyncRowActionType, message: string) => {
      row.action = action
      row.message = message
    }

    // Eşleme anahtarı hiç yoksa satır her koşuda yeniden create olur (duplicate bombası) → hata.
    if (!externalId && !tcHash && !email) {
      return fail('error', 'Eşleme anahtarı yok (sicil no / TC / e-posta) — satır işlenemedi')
    }

    // Cross-org çakışması: TC veya e-posta başka kurumda kayıtlı → manuel çözüm.
    if ((tcHash && crossOrgTcSet.has(tcHash)) || (email && crossOrgEmailSet.has(email))) {
      return fail('conflict', 'Bu TC/e-posta başka bir kurumda kayıtlı — manuel çözüm gerekir')
    }

    // Feed-içi duplicate: sonraki satır conflict.
    if (externalId) {
      const first = seenExternalIds.get(externalId)
      if (first !== undefined) return fail('conflict', `Feed içinde tekrarlayan sicil no (ilk satır: ${first})`)
      seenExternalIds.set(externalId, rowIndex)
    }
    if (tcHash) {
      const first = seenTcHashes.get(tcHash)
      if (first !== undefined) return fail('conflict', `Feed içinde tekrarlayan TC (ilk satır: ${first})`)
      seenTcHashes.set(tcHash, rowIndex)
    }
    if (email) {
      const first = seenEmails.get(email)
      if (first !== undefined) return fail('conflict', `Feed içinde tekrarlayan e-posta (ilk satır: ${first})`)
      seenEmails.set(email, rowIndex)
    }

    // Eşleşme önceliği: externalId → tcHash → email
    let user: OrgUserLite | undefined
    if (externalId) user = byExternalId.get(externalId)
    if (!user && tcHash) user = byTcHash.get(tcHash)
    if (!user && email) user = byEmail.get(email)

    if (user) {
      const firstClaim = claimedUsers.get(user.id)
      if (firstClaim !== undefined) {
        return fail('conflict', `Feed'deki birden fazla satır aynı kullanıcıyla eşleşti (ilk satır: ${firstClaim})`)
      }
      claimedUsers.set(user.id, rowIndex)
      row.user = user
      row.userId = user.id

      // Rol YÜKSELTME ASLA — entegrasyon yalnız staff hesaplarını yönetir.
      if (user.role !== 'staff') {
        return fail('conflict', 'Yönetici hesapları entegrasyonla güncellenemez')
      }
      // Sicil no uyuşmazlığı: TC/e-posta ile eşleşti ama kullanıcı FARKLI sicil no taşıyor.
      if (externalId && user.externalId && user.externalId !== externalId) {
        return fail('conflict', 'Sicil no uyuşmazlığı — kayıt TC/e-posta ile eşleşti ama kullanıcıda farklı sicil no kayıtlı')
      }
    }

    // Kaynak sistemde ayrılmış personel (delta'da da geçerli)
    if (rec.active === false) {
      if (!user) return fail('skip', 'Pasif kayıt sistemde bulunamadı — oluşturulmadı')
      if (!user.isActive) return fail('skip', 'Zaten pasif')
      row.action = 'deactivate'
      return
    }

    // Departman çözümü (create/update için ortak)
    let resolvedDeptId: string | null = null
    let pendingDeptName: string | null = null
    if (rec.departmentId) {
      if (!deptIdSet.has(rec.departmentId)) {
        return fail('error', 'Geçersiz departman — bu departman kurumunuza ait değil')
      }
      resolvedDeptId = rec.departmentId
    } else if (rec.departmentName) {
      const match = matchDepartment(rec.departmentName, departments)
      if (match.type === 'exact' || match.type === 'fuzzy') {
        resolvedDeptId = match.dept.id
      } else if (match.type === 'ambiguous') {
        return fail('error', `Departman eşleşmesi belirsiz: "${rec.departmentName}" — ${match.candidates.map(c => c.name).join(', ')}`)
      } else {
        pendingDeptName = rec.departmentName.trim()
      }
    } else if (opts.defaultDepartmentId) {
      resolvedDeptId = opts.defaultDepartmentId
    }
    row.resolvedDepartmentId = resolvedDeptId
    row.pendingDepartmentName = pendingDeptName

    if (!user) {
      row.action = 'create'
      return
    }

    // Alan farkları (yalnız feed'in gönderdiği alanlar karşılaştırılır)
    const changes: UserChanges = {}
    if (rec.firstName && rec.firstName !== user.firstName) changes.firstName = rec.firstName
    if (rec.lastName && rec.lastName !== user.lastName) changes.lastName = rec.lastName
    if (rec.phone !== undefined && rec.phone !== (user.phone ?? undefined)) changes.phone = rec.phone
    if (rec.title !== undefined && rec.title !== (user.title ?? undefined)) changes.title = rec.title
    if (email && email !== user.email.toLowerCase()) changes.email = email
    if (resolvedDeptId && resolvedDeptId !== user.departmentId) changes.departmentId = resolvedDeptId
    if (rec.hireDate) {
      const feedDay = toDayKey(rec.hireDate)
      const userDay = user.hireDate ? toDayKey(user.hireDate) : null
      if (feedDay && feedDay !== userDay) changes.hireDate = rec.hireDate
    }
    // externalId backfill — tcHash/email ile eşleşen manuel kaydı entegrasyon-yönetimli yapar
    if (externalId && user.externalId == null) changes.externalId = externalId

    const hasChanges = Object.keys(changes).length > 0 || pendingDeptName !== null
    row.changes = hasChanges ? changes : null

    if (!user.isActive) {
      // reactivate YALNIZ entegrasyon-yönetimli kullanıcıda (externalId != null veya
      // feed'de externalId ile eşleşti — ikisi de user.externalId != null demektir).
      if (user.externalId != null) {
        row.action = 'reactivate'
        return
      }
      return fail('skip', 'Pasif kayıt entegrasyon tarafından yönetilmiyor — manuel aktifleştirme gerekir')
    }

    if (!hasChanges) {
      row.action = 'skip'
      row.message = 'Fark yok'
      // skip satırında pending departman auto-create tetiklenmesin
      row.pendingDepartmentName = null
      return
    }
    row.action = 'update'
  })

  // Snapshot: feed'de olmayan entegrasyon-yönetimli (externalId != null) aktif staff
  // deaktive edilir. Manuel personel (externalId=null) ve adminlere ASLA dokunulmaz.
  if (opts.syncMode === 'snapshot' && opts.deactivateMissing) {
    let extraIndex = records.length
    for (const u of orgUsers) {
      if (u.role !== 'staff' || !u.isActive || u.externalId == null) continue
      if (claimedUsers.has(u.id)) continue
      rows.push({
        rowIndex: extraIndex++,
        action: 'deactivate',
        record: null,
        user: u,
        externalId: u.externalId,
        userId: u.id,
        message: "Feed'de bulunamadı (snapshot) — pasifleştirme planlandı",
        changes: null,
        resolvedDepartmentId: null,
        pendingDepartmentName: null,
      })
    }
  }

  const activeStaffCount = orgUsers.filter(u => u.role === 'staff' && u.isActive).length
  return { rows, activeStaffCount }
}

// ── applySync ─────────────────────────────────────────────────────────────

/** Satırın apply hatasını Türkçe mesajla `error`'a çevirir (koşu devam eder). */
function markRowError(row: PlanRow, err: unknown, fallback: string) {
  row.action = 'error'
  row.message = err instanceof AuthUserError || err instanceof DbUserError
    ? err.safeMessage
    : err instanceof Error && err.name === 'SyncRowError'
      ? err.message
      : fallback
  logger.error('sync-ingest', `Satır ${row.rowIndex} uygulanamadı`, {
    externalId: row.externalId,
    email: row.record?.email ? maskEmail(row.record.email) : null,
    err: err instanceof Error ? err.message : String(err),
  })
}

/** Kullanıcıya gösterilebilir, satır-özel apply hatası. */
class SyncRowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncRowError'
  }
}

/** Bekleyen departman adlarını (auto-create) tek tek oluşturur; ad → id haritası döner. */
async function ensureDepartments(rows: PlanRow[], organizationId: string): Promise<Map<string, string>> {
  const pendingNames = Array.from(new Set(
    rows.flatMap(r =>
      (r.action === 'create' || r.action === 'update' || r.action === 'reactivate') && r.pendingDepartmentName
        ? [r.pendingDepartmentName]
        : [],
    ),
  ))
  const nameToId = new Map<string, string>()
  for (const name of pendingNames) {
    try {
      const created = await prisma.department.create({
        data: { organizationId, name },
        select: { id: true },
      })
      nameToId.set(name, created.id)
    } catch {
      // Race/mevcut kayıt: aynı isim kök seviyede zaten var → reuse.
      const existing = await prisma.department.findFirst({
        where: { organizationId, parentId: null, name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      })
      if (existing) {
        nameToId.set(name, existing.id)
      } else {
        logger.error('sync-ingest', `Departman oluşturulamadı: ${name}`, { organizationId })
      }
    }
  }
  return nameToId
}

function resolveDeptAtApply(row: PlanRow, deptNameToId: Map<string, string>): string | null {
  if (row.resolvedDepartmentId) return row.resolvedDepartmentId
  if (row.pendingDepartmentName) return deptNameToId.get(row.pendingDepartmentName) ?? null
  return null
}

async function applyCreate(row: PlanRow, opts: SyncOptions, deptNameToId: Map<string, string>): Promise<void> {
  const rec = row.record
  if (!rec) throw new SyncRowError('Satır verisi eksik — personel oluşturulamadı')
  const departmentId = resolveDeptAtApply(row, deptNameToId)
  if (row.pendingDepartmentName && !departmentId) {
    throw new SyncRowError(`Departman oluşturulamadı: "${row.pendingDepartmentName}"`)
  }
  const email = rec.email ?? syntheticEmailFor(rec, opts.organizationId)

  const { dbUser } = await createAuthUser({
    email,
    password: generateTempPassword(),
    firstName: rec.firstName,
    lastName: rec.lastName,
    role: 'staff',
    organizationId: opts.organizationId,
    phone: rec.phone,
    title: rec.title,
    departmentId,
    mustChangePassword: true,
    // KVKK: ham TC yalnız createAuthUser içinde encrypt + hash'lenir
    tcKimlik: rec.tcKimlik,
    tcAddedByUserId: opts.requestedById ?? undefined,
  })
  row.userId = dbUser.id

  // createAuthUser externalId/hireDate almıyor → ayrı update ile setle.
  if (rec.externalId || rec.hireDate) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        ...(rec.externalId ? { externalId: rec.externalId } : {}),
        ...(rec.hireDate ? { hireDate: new Date(rec.hireDate) } : {}),
      },
    })
  }

  // Departman eğitim kurallarına göre otomatik atama (best-effort — bulk-import deseni)
  if (departmentId) {
    try {
      await autoAssignByDepartment(dbUser.id, departmentId, opts.organizationId, opts.requestedById ?? undefined)
    } catch (err) {
      logger.warn('sync-ingest', 'autoAssignByDepartment basarisiz', err instanceof Error ? err.message : err)
    }
  }
}

/** update/reactivate ortak yazımı — e-posta değişimi önce Supabase Auth ile senkronlanır. */
async function applyUserUpdate(row: PlanRow, opts: SyncOptions, deptNameToId: Map<string, string>, reactivate: boolean): Promise<void> {
  const user = row.user
  if (!user) throw new SyncRowError('Satır verisi eksik — personel güncellenemedi')
  const changes = row.changes ?? {}
  const departmentId = row.pendingDepartmentName
    ? resolveDeptAtApply(row, deptNameToId)
    : changes.departmentId ?? null
  if (row.pendingDepartmentName && !departmentId) {
    throw new SyncRowError(`Departman oluşturulamadı: "${row.pendingDepartmentName}"`)
  }

  // E-posta auth identity'dir — DB'den önce Auth güncellenir (staff PATCH deseni).
  if (changes.email) {
    const supabase = await createServiceClient()
    const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, { email: changes.email })
    if (authErr) {
      logger.error('sync-ingest', 'Auth email guncellenemedi', { userId: user.id, message: authErr.message })
      throw new SyncRowError('E-posta güncellenemedi (kimlik doğrulama sistemi reddetti)')
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(changes.firstName ? { firstName: changes.firstName } : {}),
      ...(changes.lastName ? { lastName: changes.lastName } : {}),
      ...(changes.phone !== undefined ? { phone: changes.phone } : {}),
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.email ? { email: changes.email } : {}),
      ...(departmentId && departmentId !== user.departmentId ? { departmentId } : {}),
      ...(changes.hireDate ? { hireDate: new Date(changes.hireDate) } : {}),
      ...(changes.externalId ? { externalId: changes.externalId } : {}),
      ...(reactivate ? { isActive: true, deactivatedAt: null } : {}),
    },
  })

  // Departman değiştiyse yeni departmanın kurallarına göre otomatik atama (best-effort)
  if (departmentId && departmentId !== user.departmentId) {
    try {
      await autoAssignByDepartment(user.id, departmentId, opts.organizationId, opts.requestedById ?? undefined)
    } catch (err) {
      logger.warn('sync-ingest', 'autoAssignByDepartment basarisiz', err instanceof Error ? err.message : err)
    }
  }
}

async function applySync(rows: PlanRow[], opts: SyncOptions): Promise<void> {
  const deptNameToId = await ensureDepartments(rows, opts.organizationId)

  // create — Supabase auth çağrıları 5'li chunk Promise.all (bulk-import emsali)
  const createRows = rows.filter(r => r.action === 'create')
  for (const group of chunk(createRows, 5)) {
    await Promise.all(group.map(async row => {
      try {
        await applyCreate(row, opts, deptNameToId)
      } catch (err) {
        markRowError(row, err, 'Beklenmeyen hata — personel oluşturulamadı')
      }
    }))
  }

  // update
  const updateRows = rows.filter(r => r.action === 'update')
  for (const group of chunk(updateRows, 5)) {
    await Promise.all(group.map(async row => {
      try {
        await applyUserUpdate(row, opts, deptNameToId, false)
      } catch (err) {
        markRowError(row, err, 'Beklenmeyen hata — personel güncellenemedi')
      }
    }))
  }

  // reactivate
  const reactivateRows = rows.filter(r => r.action === 'reactivate')
  for (const group of chunk(reactivateRows, 5)) {
    await Promise.all(group.map(async row => {
      try {
        await applyUserUpdate(row, opts, deptNameToId, true)
      } catch (err) {
        markRowError(row, err, 'Beklenmeyen hata — personel yeniden aktifleştirilemedi')
      }
    }))
  }

  // deactivate — ortak soft-delete primitifi (aktif sınavları da expire eder)
  const deactivateRows = rows.filter(r => r.action === 'deactivate')
  for (const group of chunk(deactivateRows, 5)) {
    await Promise.all(group.map(async row => {
      try {
        if (!row.user) throw new SyncRowError('Satır verisi eksik — personel pasifleştirilemedi')
        await deactivateStaff(row.user.id, { organizationId: opts.organizationId, wasActive: true })
        if (!row.message) row.message = 'Pasifleştirildi'
      } catch (err) {
        markRowError(row, err, 'Beklenmeyen hata — personel pasifleştirilemedi')
      }
    }))
  }
}

// ── Persist yardımcıları ──────────────────────────────────────────────────

async function persistRowResults(rows: PlanRow[], runId: string, organizationId: string): Promise<void> {
  if (rows.length === 0) return
  await prisma.syncRowResult.createMany({
    data: rows.map(row => ({
      organizationId,
      syncRunId: runId,
      rowIndex: row.rowIndex,
      externalId: row.externalId,
      action: row.action,
      userId: row.userId ?? row.user?.id ?? null,
      message: row.message,
      payloadMasked: maskPayload(row.record),
    })),
  })
}

function toOutcomes(rows: PlanRow[]): SyncRowOutcome[] {
  return rows.map(row => ({
    rowIndex: row.rowIndex,
    action: row.action,
    externalId: row.externalId,
    userId: row.userId ?? row.user?.id ?? null,
    message: row.message,
  }))
}

async function finalizeRun(
  runId: string,
  status: SyncRunStatusType,
  counts: SyncCounts,
  errorSummary?: Prisma.InputJsonObject,
): Promise<void> {
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status,
      totalRows: counts.totalRows,
      createdRows: counts.createdRows,
      updatedRows: counts.updatedRows,
      deactivatedRows: counts.deactivatedRows,
      reactivatedRows: counts.reactivatedRows,
      skippedRows: counts.skippedRows,
      failedRows: counts.failedRows,
      ...(errorSummary ? { errorSummary } : {}),
      completedAt: new Date(),
    },
  })
}

// ── runSync ───────────────────────────────────────────────────────────────

/**
 * Normalize edilmiş kayıtları org'a senkronlar (İK/HBYS ingestion çekirdeği).
 *
 * @param records `normalizeRecords` çıktısı — doğrulanmış kayıtlar
 * @param opts    Kanal/tetik/mod + güvenlik seçenekleri (`SyncOptions`)
 * @returns SyncRun id'si, durum, sayaçlar ve satır sonuçları özeti
 * @throws {ApiError} 409 — org için devam eden başka bir senkron varsa
 */
export async function runSync(records: StaffRecord[], opts: SyncOptions): Promise<SyncResult> {
  const releaseLock = await acquireSyncLock(opts.organizationId)
  try {
    const run = await prisma.syncRun.create({
      data: {
        organizationId: opts.organizationId,
        integrationId: opts.integrationId ?? null,
        channel: opts.channel,
        trigger: opts.trigger,
        mode: opts.dryRun ? 'dry_run' : 'apply',
        syncMode: opts.syncMode,
        status: 'running',
        totalRows: records.length,
        apiKeyId: opts.apiKeyId ?? null,
        requestedById: opts.requestedById ?? null,
        fileName: opts.fileName ?? null,
      },
      select: { id: true },
    })

    try {
      const plan = await planSync(records, opts)
      const { rows } = plan

      // Güvenlik eşiği — boş/yarım snapshot kazasında toplu deaktivasyonu durdurur.
      const plannedDeactivates = rows.filter(r => r.action === 'deactivate').length
      if (opts.syncMode === 'snapshot' && !opts.force) {
        const thresholdPct = opts.deactivateThresholdPct ?? 20
        const threshold = Math.max(5, Math.ceil(plan.activeStaffCount * thresholdPct / 100))
        if (plannedDeactivates > threshold) {
          const message = `Güvenlik eşiği aşıldı: ${plannedDeactivates} personel deaktive edilecekti (eşik: ${threshold}, aktif personel: ${plan.activeStaffCount}). Koşu iptal edildi — feed'in tam liste (snapshot) olduğundan eminseniz force ile tekrar deneyin.`
          await persistRowResults(rows, run.id, opts.organizationId)
          // Hiçbir şey uygulanmadı → aksiyon sayaçları 0; plan satır sonuçlarında görülebilir.
          const abortCounts: SyncCounts = {
            totalRows: rows.length,
            createdRows: 0,
            updatedRows: 0,
            deactivatedRows: 0,
            reactivatedRows: 0,
            skippedRows: 0,
            failedRows: 0,
          }
          await finalizeRun(run.id, 'aborted', abortCounts, { message, plannedDeactivates, threshold })
          logger.warn('sync-ingest', 'Senkron güvenlik eşiğinde iptal edildi', {
            organizationId: opts.organizationId, runId: run.id, plannedDeactivates, threshold,
          })
          return { runId: run.id, status: 'aborted', counts: abortCounts, rowResults: toOutcomes(rows) }
        }
      }

      // Koltuk limiti: headroom'u aşan create satırları hata (koşu durmaz).
      const createRows = rows.filter(r => r.action === 'create')
      if (createRows.length > 0) {
        const headroom = await computeStaffHeadroom(opts.organizationId, createRows.length)
        if (headroom < createRows.length) {
          for (const row of createRows.slice(headroom)) {
            row.action = 'error'
            row.message = 'Personel limiti doldu — bu satır oluşturulamadı. Planınızı yükseltin.'
          }
        }
      }

      if (opts.dryRun) {
        await persistRowResults(rows, run.id, opts.organizationId)
        const counts = countRows(rows)
        await finalizeRun(run.id, 'completed', counts)
        return { runId: run.id, status: 'completed', counts, rowResults: toOutcomes(rows) }
      }

      await applySync(rows, opts)

      await persistRowResults(rows, run.id, opts.organizationId)
      const counts = countRows(rows)
      const status: SyncRunStatusType = counts.failedRows > 0 ? 'completed_with_errors' : 'completed'
      const errorSummary = counts.failedRows > 0
        ? {
            message: `${counts.failedRows} satır hata/çakışma ile sonuçlandı`,
            samples: rows
              .filter(r => r.action === 'error' || r.action === 'conflict')
              .slice(0, 10)
              .map(r => ({ rowIndex: r.rowIndex, action: r.action, message: r.message })),
          }
        : undefined
      await finalizeRun(run.id, status, counts, errorSummary)

      return { runId: run.id, status, counts, rowResults: toOutcomes(rows) }
    } catch (err) {
      // Beklenmeyen koşu hatası — run'ı failed işaretle, hatayı yukarı taşı (route 500'ler).
      try {
        await prisma.syncRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            errorSummary: { message: 'Senkron beklenmeyen bir hatayla durdu. Lütfen tekrar deneyin.' },
            completedAt: new Date(),
          },
        })
      } catch (updateErr) {
        logger.error('sync-ingest', 'SyncRun failed durumuna çekilemedi', updateErr instanceof Error ? updateErr.message : updateErr)
      }
      throw err
    }
  } finally {
    await releaseLock()
  }
}

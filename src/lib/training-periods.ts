/**
 * Yıllık Eğitim Dönemi (Training Period) servis katmanı.
 *
 * Hastaneler için takvim yılı (1 Ocak – 31 Aralık) bazlı eğitim döngüsü.
 * Her org'da aynı anda yalnızca 1 'active' period bulunur (DB partial unique
 * index ile zorlanır). Yıl içi işe başlayan personel için tamamlanma oranı
 * `getEffectiveStartDate` ile işe başlama tarihinden itibaren hesaplanır.
 */

import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import type { PeriodStatus, TrainingPeriod } from '@/types/database'

/** Türkiye saat dilimi sabiti — period başlangıç/bitiş sınırları için. */
const TR_TIMEZONE_OFFSET = '+03:00'

export interface PeriodInput {
  year: number
  label?: string
  startDate?: Date
  endDate?: Date
  isDefault?: boolean
}

/**
 * Verilen yıl için varsayılan TR takvim sınırlarını döner (1 Oca 00:00 → 31 Ara 23:59:59).
 */
export function defaultPeriodBounds(year: number): { startDate: Date; endDate: Date } {
  return {
    startDate: new Date(`${year}-01-01T00:00:00${TR_TIMEZONE_OFFSET}`),
    endDate: new Date(`${year}-12-31T23:59:59${TR_TIMEZONE_OFFSET}`),
  }
}

/**
 * Org'un aktif period'unu döner. Yoksa 409 ApiError.
 * Aktif period org başına tek olduğu için findFirst güvenli.
 */
export async function getActivePeriod(organizationId: string) {
  const period = await prisma.trainingPeriod.findFirst({
    where: { organizationId, status: 'active' },
  })
  if (!period) {
    throw new ApiError('Aktif eğitim dönemi bulunamadı. Yeni bir dönem açın.', 409)
  }
  return period
}

/** Aktif period'u arar; yoksa null döner (defansif okumalar için). */
export async function findActivePeriod(organizationId: string) {
  return prisma.trainingPeriod.findFirst({
    where: { organizationId, status: 'active' },
  })
}

/** Tenant guard ile period fetch — başka org'un period'unu sızdırmaz. */
export async function getPeriodById(id: string, organizationId: string) {
  const period = await prisma.trainingPeriod.findFirst({
    where: { id, organizationId },
  })
  if (!period) throw new ApiError('Eğitim dönemi bulunamadı', 404)
  return period
}

export async function listPeriods(organizationId: string) {
  return prisma.trainingPeriod.findMany({
    where: { organizationId },
    orderBy: [{ year: 'desc' }],
  })
}

/**
 * Yıl içi işe başlayan personel için baz tarih.
 * `max(period.startDate, user.hireDate ?? user.createdAt)` döner — bu sayede
 * tamamlanma oranı kullanıcının "işe başladığı an"dan itibaren ölçülür ve
 * Aralık'ta gelen personel %0 görünmez.
 */
export function getEffectiveStartDate(
  user: { hireDate: Date | null; createdAt: Date },
  period: { startDate: Date },
): Date {
  const userStart = user.hireDate ?? user.createdAt
  return userStart > period.startDate ? userStart : period.startDate
}

/**
 * Yeni period oluşturur. Idempotent: aynı (org, year) varsa onu döner.
 * `status: 'active'` ile çağrılırsa partial unique index sayesinde 2. active blocked.
 */
export async function openNewPeriod(
  organizationId: string,
  input: PeriodInput,
  opts: { activate?: boolean } = {},
) {
  const existing = await prisma.trainingPeriod.findUnique({
    where: { organizationId_year: { organizationId, year: input.year } },
  })
  if (existing) return existing

  const bounds = defaultPeriodBounds(input.year)
  const isDefault = input.isDefault ?? true
  const startDate = input.startDate ?? bounds.startDate
  const endDate = input.endDate ?? bounds.endDate

  if (endDate <= startDate) {
    throw new ApiError('Dönem bitiş tarihi başlangıçtan sonra olmalı', 400)
  }

  return prisma.trainingPeriod.create({
    data: {
      organizationId,
      year: input.year,
      label: input.label ?? `${input.year} Eğitim Dönemi`,
      startDate,
      endDate,
      isDefault,
      status: opts.activate ? 'active' : 'upcoming',
    },
  })
}

/**
 * Period'u kapatır. Transaction içinde:
 * 1) status='closed', closedAt, closedById set.
 * Geri dönülemez — UI'dan onay alınmalı.
 */
export async function closePeriod(
  periodId: string,
  organizationId: string,
  closedById: string,
) {
  return prisma.$transaction(async (tx) => {
    const period = await tx.trainingPeriod.findFirst({
      where: { id: periodId, organizationId },
    })
    if (!period) throw new ApiError('Eğitim dönemi bulunamadı', 404)
    if (period.status === 'closed') throw new ApiError('Bu dönem zaten kapatılmış', 409)

    return tx.trainingPeriod.update({
      where: { id: periodId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedById,
      },
    })
  })
}

/**
 * Verilen yılın period'unu aktive eder. Aynı anda başka aktif period varsa
 * onu önce 'closed' yapar (atomik). Cron rollover ve manuel "Yeni Dönem Aç"
 * tarafından kullanılır.
 */
export async function activatePeriod(
  periodId: string,
  organizationId: string,
  closedById: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.trainingPeriod.findFirst({
      where: { id: periodId, organizationId },
    })
    if (!target) throw new ApiError('Eğitim dönemi bulunamadı', 404)
    if (target.status === 'active') return target

    // Mevcut aktif period'u kapat (varsa)
    const current = await tx.trainingPeriod.findFirst({
      where: { organizationId, status: 'active' },
    })
    if (current && current.id !== periodId) {
      await tx.trainingPeriod.update({
        where: { id: current.id },
        data: { status: 'closed', closedAt: new Date(), closedById },
      })
    }

    return tx.trainingPeriod.update({
      where: { id: periodId },
      data: { status: 'active' },
    })
  })
}

/**
 * Cron handler için: org'un aktif period'u verilen yıldan eskiyse rollover yap.
 * Idempotent: zaten doğru yıldaysa no-op döner.
 */
export async function rolloverIfNeeded(
  organizationId: string,
  currentYear: number,
): Promise<{ action: 'noop' | 'created' | 'rolled_over'; period: TrainingPeriod | null }> {
  const active = await findActivePeriod(organizationId)

  if (active && active.year === currentYear) {
    return { action: 'noop', period: active as unknown as TrainingPeriod }
  }

  // Yeni period oluştur (idempotent — varsa onu döner)
  const newPeriod = await openNewPeriod(organizationId, { year: currentYear })

  // Aktive et (eski varsa kapatır)
  const activated = await activatePeriod(newPeriod.id, organizationId, null)

  logger.info('training_period.rollover', `${currentYear} dönemi açıldı`, {
    organizationId,
    fromYear: active?.year ?? null,
    toYear: currentYear,
    newPeriodId: activated.id,
  })

  return {
    action: active ? 'rolled_over' : 'created',
    period: activated as unknown as TrainingPeriod,
  }
}

/** Period statüsü için Türkçe etiket — UI badge'leri için. */
export function periodStatusLabel(status: PeriodStatus): string {
  switch (status) {
    case 'active':
      return 'Aktif'
    case 'upcoming':
      return 'Yaklaşan'
    case 'closed':
      return 'Kapalı'
  }
}

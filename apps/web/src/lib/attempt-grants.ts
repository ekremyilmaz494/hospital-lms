import type { Prisma } from '@/generated/prisma/client'
import { assignmentNextStatus, type AssignmentStatus } from '@/lib/exam-state-machine'

/**
 * Ek sınav denemesi verme — TEK doğruluk kaynağı.
 *
 * Bir atamaya ek deneme hakkı verip yeniden açan ÜÇ route vardı ve üçü de farklı
 * davranıyordu (talep onayı / personel sayfasından "Yeni Hak" / "Sıfırla"):
 *   - round çözümü (deterministik vs non-deterministik N1 hatası),
 *   - terminal-state guard'ı (sadece `passed` vs state-machine `passed`+`locked`),
 *   - bildirim (var/yok), bekleyen talebi kapatma (var/yok).
 * Bu sapma gerçek bir hata üretiyordu: "Yeniden Ata" (round 2+) senaryosunda ek hak
 * YANLIŞ (eski terminal) round'a yazılıp personel yine sınava giremiyordu.
 *
 * `grantAttempts` o üç yolun RİSKLİ/sapan parçalarını birleştirir; "kaç hak verilecek"
 * politikası (`computeNewMax`) caller'da kalır. Çağrı `prisma.$transaction` içinden
 * `tx` ile yapılmalı (notification + reconcile atomik olsun). Audit caller'da kalır
 * (dönüş değerini kullanır) — handler context `audit()` transaction dışında çalışır.
 */

export type AttemptGrantErrorCode = 'ASSIGNMENT_NOT_FOUND' | 'INVALID_TRANSITION'

/** Helper'ın fırlattığı tipli hata — caller HTTP durumuna eşler. `message` kullanıcıya gösterilebilir (Türkçe, iç durum sızdırmaz). */
export class AttemptGrantError extends Error {
  constructor(
    public readonly code: AttemptGrantErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AttemptGrantError'
  }
}

interface GrantAttemptsArgs {
  organizationId: string
  /** Audit + bekleyen talep reconcile'ında reviewedById olarak yazılır. */
  reviewerId: string
  /**
   * Atama çözümü. `assignmentId` verilirse o atama (nokta atışı, ör. "Sıfırla").
   * Aksi halde (trainingId,userId) → resolveExamFlowState ile AYNI sıralamayla
   * EN YENİ round deterministik seçilir (N1 hatası kapanır).
   */
  target: { assignmentId: string } | { trainingId: string; userId: string }
  /** Yeni maxAttempts'i hesapla. Caller politikası: ör. `a => a.maxAttempts + N` veya `a => a.currentAttempt + a.originalMaxAttempts`. */
  computeNewMax: (a: { maxAttempts: number; currentAttempt: number; originalMaxAttempts: number }) => number
  /** Personele bildirim. `false`/verilmezse bildirim atılmaz. */
  notify?: { title: string; message: (trainingTitle: string) => string } | false
  /** Bu (trainingId,userId) için bekleyen ExamAttemptRequest varsa `approved` yap (yetim talep / çift-hak önlenir). */
  reconcilePendingRequest?: boolean
  /** Reconcile edilen talebe yazılacak grantedAttempts (genelde verilen ek hak sayısı). */
  grantedAttemptsForReconcile?: number
}

export interface GrantAttemptsResult {
  assignmentId: string
  userId: string
  userName: string
  trainingId: string
  trainingTitle: string
  previousStatus: AssignmentStatus
  previousMaxAttempts: number
  newMaxAttempts: number
}

/**
 * Atamaya ek deneme hakkı ver + yeniden aç. `prisma.$transaction` `tx`'i ile çağır.
 *
 * @throws {AttemptGrantError} `ASSIGNMENT_NOT_FOUND` (atama yok / kurum dışı) veya
 *   `INVALID_TRANSITION` (terminal `passed`/`locked` → reset edilemez).
 */
export async function grantAttempts(
  tx: Prisma.TransactionClient,
  args: GrantAttemptsArgs,
): Promise<GrantAttemptsResult> {
  const {
    organizationId,
    reviewerId,
    target,
    computeNewMax,
    notify,
    reconcilePendingRequest,
    grantedAttemptsForReconcile,
  } = args

  // 1) Atamayı çöz. organizationId denormalize alanı tenant guard'ı (defense-in-depth).
  //    (trainingId,userId) fallback'inde resolveExamFlowState ile AYNI sıralama:
  //    en yeni round'u deterministik seç — N1 (atamalar-arası round) hatasını kapatır.
  const assignment = await tx.trainingAssignment.findFirst({
    where:
      'assignmentId' in target
        ? { id: target.assignmentId, organizationId }
        : { trainingId: target.trainingId, userId: target.userId, organizationId },
    orderBy: [{ round: 'desc' }, { assignedAt: 'desc' }],
    select: {
      id: true,
      userId: true,
      trainingId: true,
      status: true,
      maxAttempts: true,
      currentAttempt: true,
      originalMaxAttempts: true,
      training: { select: { title: true } },
      user: { select: { firstName: true, lastName: true } },
    },
  })

  if (!assignment) {
    throw new AttemptGrantError('ASSIGNMENT_NOT_FOUND', 'Atama bulunamadı')
  }

  const previousStatus = assignment.status as AssignmentStatus

  // 2) State-machine ile doğrula — passed/locked reddedilir (Path C'nin referans davranışı,
  //    artık her üç yolda tutarlı). Kullanıcıya iç durum adı sızdırmadan Türkçe mesaj.
  const transition = assignmentNextStatus(previousStatus, { type: 'ATTEMPT_RESET' })
  if (!transition.ok) {
    const msg =
      previousStatus === 'passed'
        ? 'Personel bu eğitimi zaten başarıyla tamamlamış'
        : 'Bu eğitim kilitli; ek deneme hakkı verilemez'
    throw new AttemptGrantError('INVALID_TRANSITION', msg)
  }

  // 3) Reopen — maxAttempts caller politikasıyla; currentAttempt'e DOKUNMA
  //    (@@unique([assignmentId,attemptNumber]) çakışmasını önler; bkz. reset-attempt notu).
  const newMaxAttempts = computeNewMax({
    maxAttempts: assignment.maxAttempts,
    currentAttempt: assignment.currentAttempt,
    originalMaxAttempts: assignment.originalMaxAttempts,
  })

  await tx.trainingAssignment.update({
    where: { id: assignment.id },
    data: {
      status: transition.next,
      maxAttempts: newMaxAttempts,
      completedAt: null,
    },
  })

  // 4) Bildirim (opsiyonel) — her yolda tutarlı.
  if (notify) {
    await tx.notification.create({
      data: {
        userId: assignment.userId,
        organizationId,
        title: notify.title,
        message: notify.message(assignment.training.title),
        type: 'assignment',
        relatedTrainingId: assignment.trainingId,
      },
    })
  }

  // 5) Bekleyen talebi kapat (opsiyonel) — talep akışı dışından (Path B/C) hak verilince
  //    bekleyen ExamAttemptRequest yetim kalmasın + sonradan çift-onay olmasın.
  //    updateMany: 0 satırda sessizce geçer (guard zaten en fazla 1 pending bırakır).
  if (reconcilePendingRequest) {
    await tx.examAttemptRequest.updateMany({
      where: { trainingId: assignment.trainingId, userId: assignment.userId, status: 'pending' },
      data: {
        status: 'approved',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        grantedAttempts: grantedAttemptsForReconcile ?? null,
        reviewNote: 'Yönetici tarafından doğrudan ek hak verildi.',
      },
    })
  }

  return {
    assignmentId: assignment.id,
    userId: assignment.userId,
    userName: `${assignment.user.firstName} ${assignment.user.lastName}`.trim(),
    trainingId: assignment.trainingId,
    trainingTitle: assignment.training.title,
    previousStatus,
    previousMaxAttempts: assignment.maxAttempts,
    newMaxAttempts,
  }
}

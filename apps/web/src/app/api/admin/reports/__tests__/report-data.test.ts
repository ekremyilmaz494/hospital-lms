import { describe, it, expect, vi } from 'vitest'

// _report-data top-level'da prisma singleton'ı import eder; buildReportRows saf ama
// modül yükü prisma'yı kurmasın (DATABASE_URL yok → throw).
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { buildReportRows, type ReportData } from '../_report-data'
import { sanitizeSheetName } from '../_report-format'

/**
 * `buildReportRows` — admin per-hastane export'u ile grup konsolide export'unun PAYLAŞTIĞI
 * saf KPI/tablo hesap katmanı. Buradaki math bozulursa iki export da birlikte kayar, o yüzden
 * fixture ile kilitliyoruz (drift guard).
 */

type Attempt = { postExamScore: number | null; preExamScore: number | null; isPassed: boolean; status: string; attemptNumber: number }
function attempt(post: number | null, pre: number | null = null, attemptNumber = 1): Attempt {
  return { postExamScore: post, preExamScore: pre, isPassed: post != null && post >= 70, status: 'completed', attemptNumber }
}
function trainingAssignment(status: string, post: number | null, pre: number | null = null) {
  return {
    status,
    user: { firstName: 'X', lastName: 'Y', departmentRel: { name: 'Dahiliye' } },
    examAttempts: post === null && pre === null ? [] : [attempt(post, pre)],
  }
}
function staffAssignment(status: string, title: string, post: number | null, attemptNumber = 1) {
  return {
    status,
    training: { title },
    examAttempts: post === null ? [] : [attempt(post, null, attemptNumber)],
  }
}

// buildReportRows sadece staffCount/trainings/staff/departments/avgScoreResult okur.
// over gevşek tiplenir — fixture'da Prisma Decimal yerine düz number veriyoruz (runtime Number()).
function makeData(over: Record<string, unknown>): ReportData {
  return {
    org: { name: 'Test Hastanesi', logoUrl: null },
    staffCount: 3,
    trainings: [],
    staff: [],
    departments: [],
    avgScoreResult: { _avg: { postExamScore: null } },
    truncated: { trainings: null, staff: null },
    selectedDeptName: null,
    ...over,
  } as ReportData
}

describe('buildReportRows — KPI/tablo hesapları', () => {
  it('eğitim satırı: atanan/tamamlayan/başarısız/oran/ort.puan doğru', () => {
    const data = makeData({
      trainings: [
        {
          id: 't1', title: 'İSG', examDurationMinutes: 30,
          assignments: [trainingAssignment('passed', 90), trainingAssignment('failed', 40)],
          videos: [{ durationSeconds: 600 }],
        },
      ] as unknown as ReportData['trainings'],
    })
    const rows = buildReportRows(data)
    expect(rows.trainingRows).toHaveLength(1)
    const t = rows.trainingRows[0]
    expect(t).toMatchObject({ title: 'İSG', assigned: 2, completed: 1, failed: 1, rate: 50, avgScore: 65 })
  })

  it('grup roll-up sayaçları: totalAssigned/passed/failed/completionRate iki eğitim üzerinden', () => {
    const data = makeData({
      trainings: [
        { id: 't1', title: 'A', examDurationMinutes: 30, assignments: [trainingAssignment('passed', 90), trainingAssignment('failed', 40)], videos: [] },
        { id: 't2', title: 'B', examDurationMinutes: 30, assignments: [trainingAssignment('passed', 80)], videos: [] },
      ] as unknown as ReportData['trainings'],
      avgScoreResult: { _avg: { postExamScore: 70 } },
    })
    const rows = buildReportRows(data)
    expect(rows.totalAssigned).toBe(3)
    expect(rows.passedCount).toBe(2)
    expect(rows.failedCount).toBe(1)
    expect(rows.completionRate).toBe(67) // 2/3
    expect(rows.avgScore).toBe(70) // avgScoreResult'tan
  })

  it('personel satırları ort. puana göre azalan sıralı; başarısızlık satırı yalnız failed/locked', () => {
    const data = makeData({
      staff: [
        { firstName: 'Ali', lastName: 'V', departmentRel: { name: 'Acil' }, assignments: [staffAssignment('passed', 'A', 55)] },
        { firstName: 'Ayşe', lastName: 'K', departmentRel: { name: 'Acil' }, assignments: [staffAssignment('passed', 'A', 95)] },
        { firstName: 'Veli', lastName: 'D', departmentRel: { name: 'Acil' }, assignments: [staffAssignment('failed', 'B', 30, 3), staffAssignment('locked', 'C', 20, 2)] },
      ] as unknown as ReportData['staff'],
    })
    const rows = buildReportRows(data)
    // Sıralama: 95 > 55 > 25(Veli avg of 30,20)
    expect(rows.staffRows.map(s => s.name)).toEqual(['Ayşe K', 'Ali V', 'Veli D'])
    // Yıldız (>=80) / Normal (>=50) / Risk (<50, atama var)
    expect(rows.staffRows[0].status).toBe('Yıldız')
    expect(rows.staffRows[2].status).toBe('Risk')
    // failureRows: yalnız Veli'nin 2 kaydı (failed + locked), deneme sayısına göre azalan
    expect(rows.failureRows).toHaveLength(2)
    expect(rows.failureRows.every(f => f.name === 'Veli D')).toBe(true)
    expect(rows.failureRows[0].attempts).toBe(3)
  })

  it('boş veri → sıfır/oranlar patlamaz', () => {
    const rows = buildReportRows(makeData({}))
    expect(rows.totalAssigned).toBe(0)
    expect(rows.completionRate).toBe(0)
    expect(rows.avgScore).toBe(0)
    expect(rows.trainingRows).toEqual([])
  })
})

describe('sanitizeSheetName — Excel sheet adı güvenliği', () => {
  it('yasak karakterleri boşlukla değiştirir, trim eder', () => {
    const used = new Set<string>()
    expect(sanitizeSheetName('A/B:C*[D]', used)).toBe('A B C  D')
  })

  it('31 karakter sınırı', () => {
    const used = new Set<string>()
    const name = sanitizeSheetName('X'.repeat(50), used)
    expect(name.length).toBeLessThanOrEqual(31)
  })

  it('çakışan adları benzersizleştirir', () => {
    const used = new Set<string>()
    const a = sanitizeSheetName('Merkez Hastanesi', used)
    const b = sanitizeSheetName('Merkez Hastanesi', used)
    expect(a).toBe('Merkez Hastanesi')
    expect(b).not.toBe(a)
    expect(b).toContain('(2)')
  })

  it('boş ad → "Hastane" fallback', () => {
    const used = new Set<string>()
    expect(sanitizeSheetName('', used)).toBe('Hastane')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'

/**
 * POST /api/admin/question-bank/import — satır-bazlı hata raporu:
 *
 * Geçersiz satırlar atlanır ama artık kullanıcıya hangi satırın NEDEN atlandığı
 * `errorRows: { rowNumber, reason }[]` ile bildirilir (ilk 50; fazlası
 * `errorRowsTruncated`). Geriye uyumluluk: imported/errors/total korunur.
 */

const { prismaMock, txMock } = vi.hoisted(() => {
  const txMock = { questionBank: { create: vi.fn().mockResolvedValue({ id: 'q-1' }) } }
  return {
    txMock,
    prismaMock: {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}))

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (handler: (ctx: {
    request: Request
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request) => handler({
      request,
      organizationId: 'org-1',
      audit: vi.fn().mockResolvedValue(undefined),
    })
  },
}))

import { POST } from '../route'

const HEADER = ['Soru', 'Şık A', 'Şık B', 'Şık C', 'Şık D', 'Doğru', 'Zorluk', 'Kategori', 'Puan']
const VALID = ['Bu geçerli bir soru metnidir', 'birinci', 'ikinci', 'üçüncü', 'dördüncü', 'A', 'medium', 'Genel', 1]

async function importRequest(rows: (string | number)[][]): Promise<Request> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')
  rows.forEach((r) => ws.addRow(r))
  const buf = await wb.xlsx.writeBuffer()
  const file = new File([buf], 'sorular.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const formData = new FormData()
  formData.append('file', file)
  return new Request('http://localhost/api/admin/question-bank/import', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/admin/question-bank/import — errorRows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    txMock.questionBank.create.mockResolvedValue({ id: 'q-1' })
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock))
  })

  it('geçerli+hatalı karışık → doğru rowNumber ve Türkçe sebep', async () => {
    const res = await POST(await importRequest([
      HEADER,           // satır 1 (atlanır)
      VALID,            // satır 2 — geçerli
      ['abc', 'a', 'b', 'c', 'd', 'A', 'medium', 'Genel', 1],            // satır 3 — kısa metin
      VALID,            // satır 4 — geçerli
      ['Yeterince uzun soru metni', 'a', 'b', 'c', '', 'A', 'medium', 'Genel', 1], // satır 5 — eksik şık
    ]))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.imported).toBe(2)
    expect(body.errors).toBe(2)
    expect(body.errorRows).toHaveLength(2)
    expect(body.errorRows[0]).toEqual({ rowNumber: 3, reason: 'Soru metni çok kısa (en az 5 karakter)' })
    expect(body.errorRows[1]).toEqual({ rowNumber: 5, reason: 'Tüm şıklar (A-D) doldurulmalı' })
    expect(body.errorRowsTruncated).toBe(false)
  })

  it('50+ hatalı satır → errorRows 50 ile sınırlanır, truncated true', async () => {
    const rows: (string | number)[][] = [HEADER, VALID] // 1 geçerli satır (yoksa 400 döner)
    for (let i = 0; i < 60; i++) rows.push(['x', 'a', 'b', 'c', 'd', 'A', 'medium', 'Genel', 1]) // kısa metin
    const res = await POST(await importRequest(rows))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.imported).toBe(1)
    expect(body.errors).toBe(60)
    expect(body.errorRows).toHaveLength(50)
    expect(body.errorRowsTruncated).toBe(true)
  })

  it('geriye uyumluluk: imported/errors/total alanları korunur', async () => {
    const res = await POST(await importRequest([HEADER, VALID]))
    const body = await res.json()
    expect(body).toHaveProperty('imported', 1)
    expect(body).toHaveProperty('errors', 0)
    expect(body).toHaveProperty('total', 1)
    expect(body.errorRows).toEqual([])
  })
})

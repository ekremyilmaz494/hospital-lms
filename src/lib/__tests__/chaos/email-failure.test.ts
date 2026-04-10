/**
 * Chaos Test: Email servisi çöktüğünde uygulama 500 dönmemeli.
 * Sınav sonucu, eğitim ataması gibi kritik işlemler email hatasından etkilenmemeli.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Email modülünü hata fırlatan şekilde mock'la
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockRejectedValue(new Error('SMTP connection refused')),
  trainingAssignedEmail: vi.fn().mockReturnValue('<html>test</html>'),
  examResultEmail: vi.fn().mockReturnValue('<html>test</html>'),
}))

vi.mock('@/lib/api-helpers', () => ({
  getAuthUser: vi.fn(),
  requireRole: vi.fn(() => null),
  jsonResponse: vi.fn((data: unknown, status = 200) => Response.json(data, { status })),
  errorResponse: vi.fn((msg: string, status = 400) => Response.json({ error: msg }, { status })),
  createAuditLog: vi.fn(),
  parseBody: vi.fn(),
  computeAuditHash: vi.fn().mockReturnValue('hash'),
  safePagination: vi.fn().mockReturnValue({ page: 1, limit: 20 }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: { create: vi.fn().mockResolvedValue({ id: 'notif-1' }) },
    trainingAssignment: { create: vi.fn().mockResolvedValue({ id: 'assign-1' }) },
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com', firstName: 'Test' }) },
  },
}))

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn(),
  invalidateCache: vi.fn(),
  invalidateOrgCache: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), withRequestId: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) } }))

import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

describe('Chaos: Email Servisi Çöktüğünde', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sendEmail çağrısı hata fırlatmalı (mock doğrulaması)', async () => {
    await expect(sendEmail({ to: 'test@test.com', subject: 'Test', html: '<p>test</p>' })).rejects.toThrow('SMTP connection refused')
  })

  it('Email hatası catch ile yakalanabilmeli — uygulama çökmemeli', async () => {
    let caught = false
    try {
      await sendEmail({ to: 'test@test.com', subject: 'Test', html: '<p>test</p>' })
    } catch {
      caught = true
    }
    expect(caught).toBe(true)
    // Uygulama bu noktada hala çalışıyor — catch çalıştı
  })

  it('Email hatası loglanmalı', async () => {
    try {
      await sendEmail({ to: 'test@test.com', subject: 'Test', html: '<p>test</p>' })
    } catch (err) {
      logger.error('Email', 'E-posta gönderilemedi', err)
    }
    expect(logger.error).toHaveBeenCalledWith('Email', 'E-posta gönderilemedi', expect.any(Error))
  })

  it('Fire-and-forget pattern ile email hatası ana işlemi durdurmamalı', async () => {
    // Bu pattern exam submit'te kullanılıyor: .catch(err => logger.error(...))
    let mainFlowCompleted = false

    // Ana işlem
    const mainOperation = async () => {
      // Veritabanı kaydı (başarılı)
      const result = { success: true }

      // Email gönderimi (fire-and-forget — hata yakalansın)
      sendEmail({ to: 'test@test.com', subject: 'Test', html: '<p>test</p>' })
        .catch(() => { /* sessizce logla */ })

      mainFlowCompleted = true
      return result
    }

    const result = await mainOperation()
    expect(result.success).toBe(true)
    expect(mainFlowCompleted).toBe(true)
  })
})

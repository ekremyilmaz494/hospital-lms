import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-helpers')>('@/lib/api-helpers')
  return {
    ...actual,
    getAuthUser: vi.fn(),
    getAuthUserStrict: vi.fn(),
    requireRole: vi.fn(),
    checkWritePermission: vi.fn().mockResolvedValue(null),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
    jsonResponse: vi.fn((data: unknown, status = 200, headers?: Record<string, string>) =>
      Response.json(data, { status, headers }),
    ),
    errorResponse: vi.fn((msg: string, status = 400) => Response.json({ error: msg }, { status })),
  }
})

vi.mock('@/lib/redis', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { pointLedger: { findUnique: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/gamification/verify', () => ({ verifyEvent: vi.fn() }))
vi.mock('@/lib/gamification/seeding', () => ({ seedDailyReviewForTraining: vi.fn().mockResolvedValue(3) }))
vi.mock('@/lib/gamification/badges', () => ({ evaluateBadges: vi.fn().mockResolvedValue([]) }))

import { POST } from '../route'
import { getAuthUser, requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
import { verifyEvent } from '@/lib/gamification/verify'
import { seedDailyReviewForTraining } from '@/lib/gamification/seeding'
import { evaluateBadges } from '@/lib/gamification/badges'
import { Prisma } from '@/generated/prisma/client'

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockRequireRole = vi.mocked(requireRole)
const mockRateLimit = vi.mocked(checkRateLimit)
const mockFindUnique = vi.mocked(prisma.pointLedger.findUnique)
const mockCreate = vi.mocked(prisma.pointLedger.create)
const mockVerify = vi.mocked(verifyEvent)
const mockSeed = vi.mocked(seedDailyReviewForTraining)
const mockEvaluate = vi.mocked(evaluateBadges)

const EVENT_ID = 'e1e2e3e4-0000-4000-8000-000000000001'
const REF_ID = 'd1d2d3d4-0000-4000-8000-000000000002'

const staffUser = {
  user: { id: 'staff-1' },
  dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1', isActive: true },
  error: null,
} as never

function body(payload: unknown) {
  return new Request('http://localhost/api/staff/gamification/event', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/staff/gamification/event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(staffUser)
    mockRequireRole.mockReturnValue(null)
    mockRateLimit.mockResolvedValue(true)
    mockFindUnique.mockResolvedValue(null as never)
    mockCreate.mockResolvedValue({} as never)
    mockSeed.mockResolvedValue(3)
    mockEvaluate.mockResolvedValue([])
  })

  it('exam_pass doğrulanır → 50 puan, ledger yazılır, seeding + rozet çalışır', async () => {
    mockVerify.mockResolvedValue({ verified: true, trainingId: 't1' })
    mockEvaluate.mockResolvedValue([{ id: 'first_pass', tier: 'bronze', icon: 'checkmark.seal.fill' }])

    const res = await POST(body({ eventId: EVENT_ID, type: 'exam_pass', refId: REF_ID }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.pointsAwarded).toBe(50)
    expect(data.newBadges).toEqual([{ id: 'first_pass', tier: 'bronze', icon: 'checkmark.seal.fill' }])
    expect(mockVerify).toHaveBeenCalledWith('exam_pass', REF_ID, 'staff-1', 'org-1')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'exam_pass', refId: REF_ID, points: 50, dedupKey: `exam_pass:${EVENT_ID}` }),
      }),
    )
    expect(mockSeed).toHaveBeenCalledWith('staff-1', 'org-1', 't1')
  })

  it('doğrulanamayan olay → 422, ledger YAZILMAZ', async () => {
    mockVerify.mockResolvedValue({ verified: false, trainingId: null })
    const res = await POST(body({ eventId: EVENT_ID, type: 'exam_pass', refId: REF_ID }))
    expect(res.status).toBe(422)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockSeed).not.toHaveBeenCalled()
  })

  it('idempotent: aynı eventId → 0 puan, doğrulama/kredi atlanır', async () => {
    mockFindUnique.mockResolvedValue({ id: 'pl-1' } as never)
    const res = await POST(body({ eventId: EVENT_ID, type: 'exam_pass', refId: REF_ID }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.pointsAwarded).toBe(0)
    expect(mockVerify).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('eşzamanlı aynı eventId (P2002) → idempotent 0 puan', async () => {
    mockVerify.mockResolvedValue({ verified: true, trainingId: 't1' })
    mockCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '7' }),
    )
    const res = await POST(body({ eventId: EVENT_ID, type: 'exam_pass', refId: REF_ID }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.pointsAwarded).toBe(0)
  })

  it('feedback_submit: seeding YAPILMAZ ama puan verilir', async () => {
    mockVerify.mockResolvedValue({ verified: true, trainingId: 't3' })
    const res = await POST(body({ eventId: EVENT_ID, type: 'feedback_submit', refId: REF_ID }))
    const data = await res.json()
    expect(data.pointsAwarded).toBe(15)
    expect(mockSeed).not.toHaveBeenCalled()
  })

  it('geçersiz type → 400', async () => {
    const res = await POST(body({ eventId: EVENT_ID, type: 'hile', refId: REF_ID }))
    expect(res.status).toBe(400)
  })

  it('rate limit → 429', async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(body({ eventId: EVENT_ID, type: 'exam_pass', refId: REF_ID }))
    expect(res.status).toBe(429)
  })
})

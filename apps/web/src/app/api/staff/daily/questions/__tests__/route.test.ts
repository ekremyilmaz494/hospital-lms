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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dailyReview: { findMany: vi.fn(), count: vi.fn() },
    question: { findMany: vi.fn() },
  },
}))

import { GET } from '../route'
import { getAuthUser, requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockRequireRole = vi.mocked(requireRole)
const mockDueFindMany = vi.mocked(prisma.dailyReview.findMany)
const mockDueCount = vi.mocked(prisma.dailyReview.count)
const mockQuestionFindMany = vi.mocked(prisma.question.findMany)

const staffUser = {
  user: { id: 'staff-1' },
  dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1', isActive: true },
  error: null,
} as never

function req() {
  return new Request('http://localhost/api/staff/daily/questions', { method: 'GET' })
}

describe('GET /api/staff/daily/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(staffUser)
    mockRequireRole.mockReturnValue(null)
  })

  it('boş havuzda available:false döner (Cache-Control ile)', async () => {
    mockDueFindMany.mockResolvedValue([] as never)
    mockDueCount.mockResolvedValue(0 as never)

    const res = await GET(req())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.available).toBe(false)
    expect(data.dueCount).toBe(0)
    expect(data.questions).toEqual([])
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=30, stale-while-revalidate=60')
  })

  it('due sorularını döner ve isCorrect sızdırmaz', async () => {
    mockDueFindMany.mockResolvedValue([{ questionId: 'q1', box: 2 }] as never)
    mockDueCount.mockResolvedValue(1 as never)
    mockQuestionFindMany.mockResolvedValue([
      {
        id: 'q1',
        questionText: 'Soru?',
        options: [
          { id: 'a', optionText: 'A' },
          { id: 'b', optionText: 'B' },
        ],
      },
    ] as never)

    const res = await GET(req())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.available).toBe(true)
    expect(data.dueCount).toBe(1)
    expect(data.questions).toEqual([
      {
        questionId: 'q1',
        prompt: 'Soru?',
        box: 2,
        options: [
          { optionId: 'a', text: 'A' },
          { optionId: 'b', text: 'B' },
        ],
      },
    ])
    // Anti-cheat: doğru cevap hiçbir yerde sızmamalı.
    expect(JSON.stringify(data)).not.toContain('isCorrect')
    // Defense-in-depth: question select'i isCorrect istememeli.
    const arg = mockQuestionFindMany.mock.calls[0][0] as { select?: unknown }
    expect(JSON.stringify(arg.select)).not.toContain('isCorrect')
  })
})

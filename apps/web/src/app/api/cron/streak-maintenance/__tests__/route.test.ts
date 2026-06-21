import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { userStreak: { updateMany: vi.fn() } },
}))

import { GET } from '../route'
import { prisma } from '@/lib/prisma'

const mockUpdateMany = vi.mocked(prisma.userStreak.updateMany)
const OLD_SECRET = process.env.CRON_SECRET

function req(secret?: string) {
  return new Request('http://localhost/api/cron/streak-maintenance', {
    method: 'GET',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

describe('GET /api/cron/streak-maintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })
  afterAll(() => {
    process.env.CRON_SECRET = OLD_SECRET
  })

  it('CRON_SECRET yanlışsa 401, hiç güncelleme yok', async () => {
    const res = await GET(req('wrong'))
    expect(res.status).toBe(401)
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('freeze hakkı yoksa seriyi sıfırlar, varsa hakkı tüketir', async () => {
    // 1. çağrı = reset (freezesLeft<=0), 2. çağrı = freeze (freezesLeft>0)
    mockUpdateMany.mockResolvedValueOnce({ count: 2 } as never).mockResolvedValueOnce({ count: 5 } as never)

    const res = await GET(req('test-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.reset).toBe(2)
    expect(data.frozen).toBe(5)

    const resetCall = mockUpdateMany.mock.calls[0][0] as { where: Record<string, unknown>; data: Record<string, unknown> }
    const freezeCall = mockUpdateMany.mock.calls[1][0] as { where: Record<string, unknown>; data: Record<string, unknown> }
    expect(resetCall.where).toMatchObject({ freezesLeft: { lte: 0 } })
    expect(resetCall.data).toMatchObject({ current: 0 })
    expect(freezeCall.where).toMatchObject({ freezesLeft: { gt: 0 } })
    expect(freezeCall.data).toMatchObject({ freezesLeft: { decrement: 1 } })
  })
})

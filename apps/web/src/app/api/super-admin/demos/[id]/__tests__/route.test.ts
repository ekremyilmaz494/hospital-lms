import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, deleteUserMock, auditMock } = vi.hoisted(() => ({
  prismaMock: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
    trainingFeedbackAnswer: { deleteMany: vi.fn() },
    trainingFeedbackResponse: { deleteMany: vi.fn() },
    trainingFeedbackItem: { deleteMany: vi.fn() },
    trainingFeedbackCategory: { deleteMany: vi.fn() },
    trainingFeedbackForm: { deleteMany: vi.fn() },
    certificate: { deleteMany: vi.fn() },
    examAnswer: { deleteMany: vi.fn() },
    videoProgress: { deleteMany: vi.fn() },
    examAttemptRequest: { deleteMany: vi.fn() },
    examAttempt: { deleteMany: vi.fn() },
    scormAttempt: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    dailyReview: { deleteMany: vi.fn() },
    dailySubmission: { deleteMany: vi.fn() },
    pointLedger: { deleteMany: vi.fn() },
    userStreak: { deleteMany: vi.fn() },
    userBadge: { deleteMany: vi.fn() },
    competencyAnswer: { deleteMany: vi.fn() },
    competencyEvaluation: { deleteMany: vi.fn() },
    competencyItem: { deleteMany: vi.fn() },
    competencyCategory: { deleteMany: vi.fn() },
    competencyForm: { deleteMany: vi.fn() },
    accreditationReport: { deleteMany: vi.fn() },
    accreditationStandard: { deleteMany: vi.fn() },
    departmentTrainingRule: { deleteMany: vi.fn() },
    trainingAssignment: { deleteMany: vi.fn() },
    questionOption: { deleteMany: vi.fn() },
    question: { deleteMany: vi.fn() },
    trainingVideo: { deleteMany: vi.fn() },
    training: { deleteMany: vi.fn() },
    smgTarget: { deleteMany: vi.fn() },
    smgActivity: { deleteMany: vi.fn() },
    smgPeriod: { deleteMany: vi.fn() },
    smgCategory: { deleteMany: vi.fn() },
    mediaAsset: { deleteMany: vi.fn() },
    questionBankOption: { deleteMany: vi.fn() },
    questionBank: { deleteMany: vi.fn() },
    trainingCategory: { deleteMany: vi.fn() },
    trainingPeriod: { deleteMany: vi.fn() },
    invitation: { deleteMany: vi.fn() },
    kvkkRequest: { deleteMany: vi.fn() },
    dbBackup: { deleteMany: vi.fn() },
    organizationSubscription: { deleteMany: vi.fn() },
    department: { deleteMany: vi.fn() },
    user: { deleteMany: vi.fn() },
  },
  deleteUserMock: vi.fn().mockResolvedValue({ error: null }),
  auditMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({
    auth: { admin: { deleteUser: deleteUserMock } },
  })),
}))
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}))
vi.mock('@/lib/api-handler', () => ({
  withSuperAdminRoute: <P,>(handler: (ctx: {
    request: Request
    params: P
    audit: typeof auditMock
  }) => Promise<Response>) => async (request: Request, routeCtx?: { params: Promise<P> }) => handler({
    request,
    params: routeCtx?.params ? await routeCtx.params : ({ id: 'org-1' } as P),
    audit: auditMock,
  }),
}))

import { DELETE } from '../route'

describe('DELETE /api/super-admin/demos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteUserMock.mockResolvedValue({ error: null })
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<void>) => fn(prismaMock))
  })

  it('gerçek müşteri organizasyonunu silmeyi reddeder', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-real',
      name: 'Gerçek Hastane',
      code: 'REAL',
      isDemo: false,
      users: [],
    })

    const res = await DELETE(new Request('http://localhost/api/super-admin/demos/org-real', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'org-real' }),
    })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('Gerçek müşteri')
    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('demo silerken auth kullanıcılarını temizler ve transaction çalıştırır', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-demo',
      name: 'Demo Hastane #1',
      code: 'DEMO-123',
      isDemo: true,
      users: [{ id: 'user-1', email: 'admin@demo.local' }],
    })

    const res = await DELETE(new Request('http://localhost/api/super-admin/demos/org-demo', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'org-demo' }),
    })

    expect(res.status).toBe(200)
    expect(deleteUserMock).toHaveBeenCalledWith('user-1')
    expect(prismaMock.organization.delete).toHaveBeenCalledWith({ where: { id: 'org-demo' } })
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'demo.delete' }))
  })
})

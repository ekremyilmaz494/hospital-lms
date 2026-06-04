import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * SCORM tracking route — D1a (assignment durum geçişi) + C2 (rate limit) regresyon guard.
 *
 * D1a: Eskiden SCORM tamamlanması TrainingAssignment durumunu hiç güncellemiyordu;
 * personel rapor/dashboard'da "atandı"da kalıyordu. Artık:
 *   - POST (oturum başlat): assignment 'assigned' ise → in_progress (ATTEMPT_STARTED)
 *   - PATCH passed/completed: assignment → passed (assigned ise önce in_progress, sonra passed)
 * Tümü state machine üzerinden (bypass yok), org-filtreli, atomik guard + audit.
 */

const { prismaMock, auditMock, rateLimitMock } = vi.hoisted(() => ({
  prismaMock: {
    trainingAssignment: { findFirst: vi.fn(), updateMany: vi.fn() },
    scormAttempt: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    certificate: { findFirst: vi.fn(), create: vi.fn() },
    examAttempt: { findFirst: vi.fn() },
    training: { findUnique: vi.fn() },
  },
  auditMock: vi.fn().mockResolvedValue(undefined),
  rateLimitMock: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: rateLimitMock }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data as object, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => { try { return await req.json() } catch { return null } },
}))
vi.mock('@/lib/api-handler', () => ({
  withStaffRoute: <P>(
    handler: (c: {
      request: Request
      params: P
      dbUser: { id: string; role: string; organizationId: string }
      organizationId: string
      audit: typeof auditMock
    }) => Promise<Response>,
  ) => {
    return async (request: Request, { params }: { params: Promise<P> }) =>
      handler({
        request,
        params: await params,
        dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1' },
        organizationId: 'org-1',
        audit: auditMock,
      })
  },
}))

import { POST, PATCH } from '../route'

const TRAINING_ID = 'training-1'

function postReq() {
  return new Request(`http://localhost/api/exam/${TRAINING_ID}/scorm/tracking`, { method: 'POST' })
}
function patchReq(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/exam/${TRAINING_ID}/scorm/tracking`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
const params = () => ({ params: Promise.resolve({ id: TRAINING_ID }) })

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.mockResolvedValue(true)
  prismaMock.scormAttempt.create.mockResolvedValue({ id: 'scorm-1', attemptId: 'att-1' })
  prismaMock.scormAttempt.update.mockResolvedValue({ id: 'scorm-1' })
  prismaMock.trainingAssignment.updateMany.mockResolvedValue({ count: 1 })
  // Sertifika bloğunu izole et: mevcut cert var → cert üretimi atlanır.
  prismaMock.certificate.findFirst.mockResolvedValue({ id: 'cert-1' })
})

describe('POST /scorm/tracking — oturum başlat (D1a)', () => {
  it("assignment 'assigned' ise in_progress'e taşınır (ATTEMPT_STARTED, atomik guard)", async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({ id: 'asg-1', status: 'assigned' })

    const res = await POST(postReq(), params())

    expect(res.status).toBe(201)
    expect(prismaMock.scormAttempt.create).toHaveBeenCalledOnce()
    expect(prismaMock.trainingAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: 'asg-1', status: 'assigned' },
      data: { status: 'in_progress' },
    })
  })

  it("assignment zaten 'in_progress' ise durum güncellenmez", async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({ id: 'asg-1', status: 'in_progress' })

    const res = await POST(postReq(), params())

    expect(res.status).toBe(201)
    expect(prismaMock.trainingAssignment.updateMany).not.toHaveBeenCalled()
  })

  it('assignment yoksa 403 döner ve scormAttempt oluşturulmaz', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue(null)

    const res = await POST(postReq(), params())

    expect(res.status).toBe(403)
    expect(prismaMock.scormAttempt.create).not.toHaveBeenCalled()
  })

  it('assignment lookup organizationId ile filtrelenir (tenant izolasyonu)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({ id: 'asg-1', status: 'assigned' })

    await POST(postReq(), params())

    const where = prismaMock.trainingAssignment.findFirst.mock.calls[0][0].where
    expect(where.organizationId).toBe('org-1')
    expect(where.userId).toBe('staff-1')
  })

  it('rate limit aşılırsa 429 döner', async () => {
    rateLimitMock.mockResolvedValue(false)

    const res = await POST(postReq(), params())

    expect(res.status).toBe(429)
    expect(prismaMock.trainingAssignment.findFirst).not.toHaveBeenCalled()
  })
})

describe('PATCH /scorm/tracking — tamamlanma → assignment passed (D1a)', () => {
  beforeEach(() => {
    prismaMock.scormAttempt.findFirst.mockResolvedValue({
      id: 'scorm-1', lessonStatus: 'incomplete', suspendData: null, score: null,
      totalTime: null, completionStatus: null, successStatus: null,
    })
  })

  it("lessonStatus 'passed' + assignment 'in_progress' → passed + audit", async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({ id: 'asg-1', status: 'in_progress' })

    const res = await PATCH(patchReq({ lessonStatus: 'passed' }), params())

    expect(res.status).toBe(200)
    const call = prismaMock.trainingAssignment.updateMany.mock.calls[0][0]
    expect(call.data).toEqual({ status: 'passed' })
    expect(call.where.id).toBe('asg-1')
    // Atomik guard: yalnız non-terminal iken yaz
    expect(call.where.status.notIn).toEqual(expect.arrayContaining(['passed', 'failed', 'locked']))
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'scorm.assignment_passed' }))
  })

  it("lessonStatus 'completed' + assignment 'assigned' → assigned→in_progress→passed", async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({ id: 'asg-1', status: 'assigned' })

    const res = await PATCH(patchReq({ lessonStatus: 'completed' }), params())

    expect(res.status).toBe(200)
    expect(prismaMock.trainingAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'passed' } }),
    )
  })

  it("assignment zaten terminal ('passed') ise durum güncellenmez (idempotent)", async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({ id: 'asg-1', status: 'passed' })

    const res = await PATCH(patchReq({ lessonStatus: 'passed' }), params())

    expect(res.status).toBe(200)
    expect(prismaMock.trainingAssignment.updateMany).not.toHaveBeenCalled()
    expect(auditMock).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'scorm.assignment_passed' }))
  })

  it("lessonStatus geçiş değilse (incomplete) assignment'a dokunulmaz", async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({ id: 'asg-1', status: 'in_progress' })

    const res = await PATCH(patchReq({ lessonStatus: 'incomplete' }), params())

    expect(res.status).toBe(200)
    expect(prismaMock.trainingAssignment.updateMany).not.toHaveBeenCalled()
  })

  it('rate limit aşılırsa 429 döner', async () => {
    rateLimitMock.mockResolvedValue(false)

    const res = await PATCH(patchReq({ lessonStatus: 'passed' }), params())

    expect(res.status).toBe(429)
    expect(prismaMock.scormAttempt.findFirst).not.toHaveBeenCalled()
  })
})

describe('PATCH /scorm/tracking — sertifika üretimi (D1b)', () => {
  beforeEach(() => {
    prismaMock.scormAttempt.findFirst.mockResolvedValue({
      id: 'scorm-1', lessonStatus: 'incomplete', suspendData: null, score: null,
      totalTime: null, completionStatus: null, successStatus: null,
    })
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({ id: 'asg-1', status: 'in_progress' })
    prismaMock.certificate.create.mockResolvedValue({ id: 'cert-1' })
    prismaMock.training.findUnique.mockResolvedValue({ renewalPeriodMonths: null })
    // Sertifika yok → üretim yoluna gir.
    prismaMock.certificate.findFirst.mockResolvedValue(null)
  })

  it('saf SCORM (ExamAttempt yok) → scormAttemptId ile sertifika üretilir', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(null)

    const res = await PATCH(patchReq({ lessonStatus: 'completed' }), params())

    expect(res.status).toBe(200)
    const data = prismaMock.certificate.create.mock.calls[0][0].data
    expect(data.scormAttemptId).toBe('scorm-1')
    expect(data.attemptId).toBeUndefined()
    expect(data.organizationId).toBe('org-1')
  })

  it('hibrit (ExamAttempt var) → attemptId ile sertifika üretilir (scormAttemptId yok)', async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue({ id: 'exam-1' })

    const res = await PATCH(patchReq({ lessonStatus: 'passed' }), params())

    expect(res.status).toBe(200)
    const data = prismaMock.certificate.create.mock.calls[0][0].data
    expect(data.attemptId).toBe('exam-1')
    expect(data.scormAttemptId).toBeUndefined()
  })

  it('sertifika zaten varsa yeni üretilmez (idempotent)', async () => {
    prismaMock.certificate.findFirst.mockResolvedValue({ id: 'cert-existing' })
    prismaMock.examAttempt.findFirst.mockResolvedValue(null)

    const res = await PATCH(patchReq({ lessonStatus: 'passed' }), params())

    expect(res.status).toBe(200)
    expect(prismaMock.certificate.create).not.toHaveBeenCalled()
  })

  it("lessonStatus geçiş değilse sertifika üretilmez", async () => {
    prismaMock.examAttempt.findFirst.mockResolvedValue(null)

    const res = await PATCH(patchReq({ lessonStatus: 'incomplete' }), params())

    expect(res.status).toBe(200)
    expect(prismaMock.certificate.create).not.toHaveBeenCalled()
  })
})

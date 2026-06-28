import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Admin Assignments PATCH — personel sayfasından "Yeni Hak" (doğrudan ek deneme).
 *
 * **KÖK NEDEN (N1):** Eski PATCH `findFirst({ where:{ trainingId,userId } })` — orderBy + tenant
 * filtresi YOK'tu; "Yeniden Ata" (round 2+) senaryosunda non-deterministik bir round seçip ek
 * hakkı YANLIŞ round'a yazıyordu → personel hâlâ sınava giremiyordu. Artık ortak `grantAttempts`
 * helper'ı en yeni round'u deterministik çözer, state-machine ile doğrular, bekleyen talebi kapatır.
 */

const { prismaMock, txMock, checkRateLimitMock, auditMock } = vi.hoisted(() => {
  const txMock = {
    trainingAssignment: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    notification: { create: vi.fn().mockResolvedValue({}) },
    examAttemptRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return {
    txMock,
    prismaMock: { $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)) },
    checkRateLimitMock: vi.fn().mockResolvedValue(true),
    auditMock: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/redis', () => ({ checkRateLimit: checkRateLimitMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => req.json().catch(() => null),
  safePagination: () => ({ page: 1, limit: 10, skip: 0 }),
}));
vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: <P>(handler: (ctx: {
    request: Request; params: P;
    dbUser: { id: string; organizationId: string };
    organizationId: string; audit: () => Promise<void>;
  }) => Promise<Response>) =>
    async (request: Request, { params }: { params: Promise<P> }) =>
      handler({
        request, params: await params,
        dbUser: { id: 'admin-1', organizationId: 'org-1' },
        organizationId: 'org-1', audit: auditMock,
      }),
}));
vi.mock('@/lib/validations', () => ({
  createAssignmentSchema: { safeParse: (input: unknown) => ({ success: true, data: input }) },
}));
vi.mock('@/lib/dashboard-cache', () => ({ invalidateDashboardCache: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  trainingAssignedEmail: vi.fn().mockReturnValue('<html></html>'),
}));
vi.mock('@/lib/training-periods', () => ({
  getOrCreateActivePeriodForAssignment: vi.fn(),
  findActivePeriod: vi.fn(),
}));

import { PATCH } from '../assignments/route';

// userId zod ile UUID doğrulanıyor — gerçek staff sayfası UUID gönderir.
const UID = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ id: 'tr-1' }) };

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/trainings/tr-1/assignments', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue(true);
  txMock.trainingAssignment.findFirst.mockResolvedValue({
    id: 'asgn-round2', userId: UID, trainingId: 'tr-1', status: 'failed',
    maxAttempts: 3, currentAttempt: 3, originalMaxAttempts: 3,
    training: { title: 'Yangın Güvenliği' }, user: { firstName: 'Ali', lastName: 'Veli' },
  });
});

describe('Admin PATCH /api/admin/trainings/[id]/assignments — Yeni Hak', () => {
  it('en yeni round deterministik + tenant filtresiyle çözülür ve hak SEÇİLEN round\'a yazılır (N1)', async () => {
    const res = await PATCH(patchRequest({ userId: UID, additionalAttempts: 2 }), ctx);
    expect(res.status).toBe(200);

    const findCall = txMock.trainingAssignment.findFirst.mock.calls[0][0];
    expect(findCall.where).toMatchObject({ trainingId: 'tr-1', userId: UID, organizationId: 'org-1' });
    expect(findCall.orderBy).toEqual([{ round: 'desc' }, { assignedAt: 'desc' }]);

    const upd = txMock.trainingAssignment.update.mock.calls[0][0];
    expect(upd.where.id).toBe('asgn-round2');
    expect(upd.data).toMatchObject({ status: 'assigned', maxAttempts: 5, completedAt: null });
  });

  it('bekleyen ek-hak talebi de approved yapılır (yetim/çift-hak önlenir)', async () => {
    await PATCH(patchRequest({ userId: UID, additionalAttempts: 1 }), ctx);
    const u = txMock.examAttemptRequest.updateMany.mock.calls[0][0];
    expect(u.where).toMatchObject({ trainingId: 'tr-1', userId: UID, status: 'pending' });
    expect(u.data).toMatchObject({ status: 'approved', reviewedById: 'admin-1' });
  });

  it('locked atama reddedilir (400), hak yazılmaz', async () => {
    txMock.trainingAssignment.findFirst.mockResolvedValueOnce({
      id: 'asgn-locked', userId: UID, trainingId: 'tr-1', status: 'locked',
      maxAttempts: 3, currentAttempt: 3, originalMaxAttempts: 3,
      training: { title: 'X' }, user: { firstName: 'A', lastName: 'B' },
    });
    const res = await PATCH(patchRequest({ userId: UID, additionalAttempts: 1 }), ctx);
    expect(res.status).toBe(400);
    expect(txMock.trainingAssignment.update).not.toHaveBeenCalled();
  });

  it('rate-limit aşılırsa 429 döner, transaction çalışmaz', async () => {
    checkRateLimitMock.mockResolvedValueOnce(false);
    const res = await PATCH(patchRequest({ userId: UID, additionalAttempts: 1 }), ctx);
    expect(res.status).toBe(429);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('userId yoksa 400 (zod) döner', async () => {
    const res = await PATCH(patchRequest({ additionalAttempts: 2 }), ctx);
    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Admin Attempt-Requests PATCH (approve) — ek deneme hakkı doğru (en yeni) round'a yazılmalı.
 *
 * **KÖK NEDEN:** ExamAttemptRequest yalnız trainingId+userId taşır; aynı eğitim için
 * birden çok atama (round) olabilir. orderBy'sız findFirst non-deterministik bir round
 * seçip ek deneme hakkını YANLIŞ (eski terminal) round'a yazabiliyordu → personel hâlâ
 * sınava giremiyordu (N1 sınıfı; /api/exam dışı olduğu için perf-check görmüyordu).
 *
 * **KARAR:** resolveExamFlowState ile aynı sıralama — en yeni round'u deterministik seç.
 */

const { prismaMock, txMock, checkRateLimitMock } = vi.hoisted(() => {
  const txMock = {
    examAttemptRequest: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    trainingAssignment: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    notification: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    txMock,
    prismaMock: { $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)) },
    checkRateLimitMock: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/redis', () => ({ checkRateLimit: checkRateLimitMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => req.json().catch(() => null),
}));
vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (
    handler: (ctx: {
      request: Request;
      params: { id: string };
      dbUser: { id: string; organizationId: string };
      organizationId: string;
      audit: (p: unknown) => Promise<void>;
    }) => Promise<Response>
  ) => {
    // Gerçek wrapper params Promise'ini resolve edip handler'a çözülmüş objeyi geçer.
    return async (request: Request, ctx?: { params?: Promise<{ id: string }> }) =>
      handler({
        request,
        params: ctx?.params ? await ctx.params : { id: 'req-1' },
        dbUser: { id: 'admin-1', organizationId: 'org-1' },
        organizationId: 'org-1',
        audit: vi.fn(),
      });
  },
}));

import { PATCH } from '../route';

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/attempt-requests/req-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue(true);
  txMock.examAttemptRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    status: 'pending',
    organizationId: 'org-1',
    userId: 'user-1',
    trainingId: 'tr-1',
    training: { title: 'Test Eğitim' },
  });
  txMock.examAttemptRequest.update.mockResolvedValue({});
  txMock.trainingAssignment.update.mockResolvedValue({});
  txMock.notification.create.mockResolvedValue({});
});

describe('Admin attempt-requests PATCH approve — ek deneme en yeni round\'a yazılır', () => {
  it('atama resolver sıralaması + organizationId ile çözülür ve hak SEÇİLEN round\'a yazılır', async () => {
    txMock.trainingAssignment.findFirst.mockResolvedValue({
      id: 'asgn-round2', maxAttempts: 3, currentAttempt: 3, originalMaxAttempts: 3, status: 'failed',
      userId: 'user-1', trainingId: 'tr-1', training: { title: 'Test Eğitim' }, user: { firstName: 'Ali', lastName: 'Veli' },
    });

    const res = await PATCH(patchRequest({ action: 'approve', grantedAttempts: 2 }), { params: Promise.resolve({ id: 'req-1' }) });
    expect(res.status).toBe(200);

    // N1 kilidi: deterministik en-yeni-round sıralaması + tenant filtresi.
    const findCall = txMock.trainingAssignment.findFirst.mock.calls[0][0] as {
      where: { trainingId: string; userId: string; organizationId: string };
      orderBy: unknown;
    };
    expect(findCall.where.organizationId).toBe('org-1');
    expect(findCall.orderBy).toEqual([{ round: 'desc' }, { assignedAt: 'desc' }]);

    // Hak SEÇİLEN atamaya (asgn-round2) yazılmalı, maxAttempts 3+2=5.
    const updateCall = txMock.trainingAssignment.update.mock.calls[0][0] as {
      where: { id: string };
      data: { maxAttempts: number };
    };
    expect(updateCall.where.id).toBe('asgn-round2');
    expect(updateCall.data.maxAttempts).toBe(5);
  });

  it('seçilen en yeni round zaten passed → reddedilir (400), hak yazılmaz', async () => {
    txMock.trainingAssignment.findFirst.mockResolvedValue({
      id: 'asgn-round2', maxAttempts: 3, currentAttempt: 3, originalMaxAttempts: 3, status: 'passed',
      userId: 'user-1', trainingId: 'tr-1', training: { title: 'Test Eğitim' }, user: { firstName: 'Ali', lastName: 'Veli' },
    });

    const res = await PATCH(patchRequest({ action: 'approve', grantedAttempts: 1 }), { params: Promise.resolve({ id: 'req-1' }) });
    expect(res.status).toBe(400);
    expect(txMock.trainingAssignment.update).not.toHaveBeenCalled();
  });
});

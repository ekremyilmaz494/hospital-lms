import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Staff Attempt-Requests POST — atama çözümünde N1 round-determinizm kilidi.
 *
 * **KÖK NEDEN:** Aynı eğitim için birden çok atama (Yeniden Ata round'u) olabilir
 * (@@unique([trainingId,userId,periodId,round])). orderBy'sız findFirst non-deterministik
 * bir round seçiyordu → status/currentAttempt guard'ları yanlış round'a uygulanıp hatalı
 * talep oluşturulabiliyordu. Bu test resolver sıralamasını (en yeni round) kilitler.
 */

const { prismaMock, checkRateLimitMock } = vi.hoisted(() => ({
  prismaMock: {
    trainingAssignment: { findFirst: vi.fn() },
    examAttemptRequest: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  },
  checkRateLimitMock: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/redis', () => ({ checkRateLimit: checkRateLimitMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => req.json().catch(() => null),
}));
vi.mock('@/lib/api-handler', () => ({
  withStaffRoute: (
    handler: (ctx: {
      request: Request;
      dbUser: { id: string; firstName: string; lastName: string; organizationId: string };
      organizationId: string;
    }) => Promise<Response>
  ) => {
    return async (request: Request) =>
      handler({
        request,
        dbUser: { id: 'staff-1', firstName: 'Ada', lastName: 'Lovelace', organizationId: 'org-1' },
        organizationId: 'org-1',
      });
  },
}));

import { POST } from '../route';

// Geçerli UUID v4 (zod/v4 .uuid() version/variant nibble'larını denetler).
const TRAINING_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/staff/attempt-requests', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue(true);
  prismaMock.examAttemptRequest.findFirst.mockResolvedValue(null);
  prismaMock.examAttemptRequest.create.mockResolvedValue({ id: 'req-1', status: 'pending', createdAt: new Date('2026-06-01') });
  prismaMock.user.findMany.mockResolvedValue([]);
});

describe('Staff attempt-requests POST — atama round determinizmi', () => {
  it('en yeni round atamasını (exhausted) seçip 201 döner ve findFirst resolver sıralaması + organizationId ile çağrılır', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({
      id: 'asgn-round2',
      status: 'failed',
      currentAttempt: 3,
      maxAttempts: 3,
      training: { organizationId: 'org-1', title: 'Test Eğitim' },
    });

    const res = await POST(postRequest({ trainingId: TRAINING_ID, reason: 'Ek hak istiyorum lütfen' }));
    expect(res.status).toBe(201);

    // N1 kilidi: atama çözümü deterministik en-yeni-round sıralamasıyla + tenant filtresiyle.
    const call = prismaMock.trainingAssignment.findFirst.mock.calls[0][0] as {
      where: { trainingId: string; userId: string; organizationId: string };
      orderBy: unknown;
    };
    expect(call.where.organizationId).toBe('org-1');
    expect(call.where.trainingId).toBe(TRAINING_ID);
    expect(call.orderBy).toEqual([{ round: 'desc' }, { assignedAt: 'desc' }]);
  });

  it('seçilen (en yeni) round hâlâ deneme hakkı içeriyorsa 400 — yanlış round seçimi olsaydı kaçabilirdi', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({
      id: 'asgn-round2',
      status: 'in_progress',
      currentAttempt: 1,
      maxAttempts: 3,
      training: { organizationId: 'org-1', title: 'Test Eğitim' },
    });

    const res = await POST(postRequest({ trainingId: TRAINING_ID }));
    expect(res.status).toBe(400);
    expect(prismaMock.examAttemptRequest.create).not.toHaveBeenCalled();
  });
});

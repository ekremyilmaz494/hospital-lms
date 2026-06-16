import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Competency Evaluations POST — subjectId tenant doğrulaması (cross-tenant yazım regresyonu).
 *
 * **KÖK NEDEN:** subjectId yalnız includeSelf=true iken evaluators'a (dolayısıyla
 * org-doğrulamasına) giriyordu. includeSelf=false gönderildiğinde subjectId hiç
 * doğrulanmadan createMany + notification'a akıyordu → admin, başka org'a ait bir
 * kullanıcının UUID'sini subjectId vererek o yabancı kullanıcı hakkında
 * CompetencyEvaluation satırları oluşturabiliyordu (DEĞİŞMEZ KISIT 1 ihlali).
 *
 * **KARAR:** subjectId + tüm evaluator ID'leri (Set ile dedup) organizationId ile
 * doğrulanır; biri org'a ait değilse 400 ve hiçbir yazım yapılmaz.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    competencyForm: { findFirst: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    competencyEvaluation: { createMany: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => req.json().catch(() => null),
  safePagination: () => ({ page: 1, limit: 20, skip: 0 }),
}));

// startEvaluationSchema'yı passthrough mock'la — bu test tenant-doğrulama mantığını izole
// eder, zod şema detayına bağlanmaz.
vi.mock('@/lib/validations', () => ({
  startEvaluationSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (
    handler: (ctx: {
      request: Request;
      organizationId: string;
      audit: (p: unknown) => Promise<void>;
    }) => Promise<Response>
  ) => {
    return async (request: Request) =>
      handler({ request, organizationId: 'org-1', audit: vi.fn() });
  },
}));

import { POST } from '../route';

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/competency/evaluations', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.competencyForm.findFirst.mockResolvedValue({ id: 'form-1', title: 'Yetkinlik Formu', organizationId: 'org-1' });
  prismaMock.competencyEvaluation.createMany.mockResolvedValue({ count: 1 });
  prismaMock.user.findUnique.mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace' });
  prismaMock.notification.createMany.mockResolvedValue({ count: 0 });
  prismaMock.notification.create.mockResolvedValue({});
});

describe('Competency evaluations POST — subjectId tenant doğrulaması', () => {
  it('includeSelf=false + başka org\'a ait subjectId → 400, hiçbir yazım yok (cross-tenant engellendi)', async () => {
    // Yabancı subject org'a ait olmadığı için findMany onu döndürmez; yalnız peer döner.
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'peer-1' }]);

    const res = await POST(
      postRequest({
        formId: 'form-1',
        subjectId: 'foreign-subject',
        managerId: undefined,
        peerIds: ['peer-1'],
        subordinateIds: [],
        includeSelf: false,
      })
    );

    expect(res.status).toBe(400);
    // subjectId doğrulama setine dahil edildiği için createMany/notification ASLA çalışmaz.
    expect(prismaMock.competencyEvaluation.createMany).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    // findMany çağrısı subjectId'yi de içermeli (doğrulama kapsamı genişledi).
    const whereArg = prismaMock.user.findMany.mock.calls[0][0] as { where: { id: { in: string[] }; organizationId: string } };
    expect(whereArg.where.id.in).toContain('foreign-subject');
    expect(whereArg.where.organizationId).toBe('org-1');
  });

  it('includeSelf=false + org\'a ait subjectId ve peer → 201, kayıtlar oluşturulur', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'subj-1' }, { id: 'peer-1' }]);

    const res = await POST(
      postRequest({
        formId: 'form-1',
        subjectId: 'subj-1',
        managerId: undefined,
        peerIds: ['peer-1'],
        subordinateIds: [],
        includeSelf: false,
      })
    );

    expect(res.status).toBe(201);
    expect(prismaMock.competencyEvaluation.createMany).toHaveBeenCalledTimes(1);
  });

  it('includeSelf=true + subjectId org\'a ait → 201 (Set dedup ile sayım tutarlı, regresyon yok)', async () => {
    // subjectId hem SELF evaluator hem subject; dedup sayesinde idsToValidate'te bir kez yer alır.
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'subj-1' }]);

    const res = await POST(
      postRequest({
        formId: 'form-1',
        subjectId: 'subj-1',
        managerId: undefined,
        peerIds: [],
        subordinateIds: [],
        includeSelf: true,
      })
    );

    expect(res.status).toBe(201);
    expect(prismaMock.competencyEvaluation.createMany).toHaveBeenCalledTimes(1);
  });
});

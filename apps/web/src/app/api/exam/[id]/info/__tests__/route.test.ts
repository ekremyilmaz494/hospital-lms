import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * SCORM player'ının okuduğu eğitim özeti route'u — org izolasyonu + atama sahipliği.
 *
 * `id` = trainingId. Sınır content/tracking route'larıyla aynı: eğitim yoksa 404;
 * super_admin olmayan için farklı org 403; 'staff' rolünde atama yoksa 403. Bu test,
 * atama sorgusunun yalnız gereken durumlarda yapıldığını (org-mismatch/super_admin'de
 * ATLANDIĞINI) ve gövdenin SCORM alanlarını taşıdığını kilitler.
 */

const { prismaMock, ctx } = vi.hoisted(() => ({
  prismaMock: {
    training: { findUnique: vi.fn() },
    trainingAssignment: { findFirst: vi.fn() },
  },
  ctx: { role: 'staff' as string, organizationId: 'org-1' },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));
vi.mock('@/lib/api-handler', () => ({
  withStaffRoute: <P>(
    handler: (c: {
      request: Request;
      params: P;
      dbUser: { id: string; role: string; organizationId: string };
      organizationId: string;
      audit: () => Promise<void>;
    }) => Promise<Response>
  ) => {
    return async (request: Request, { params }: { params: Promise<P> }) =>
      handler({
        request,
        params: await params,
        dbUser: { id: 'staff-1', role: ctx.role, organizationId: ctx.organizationId },
        organizationId: ctx.organizationId,
        audit: vi.fn().mockResolvedValue(undefined),
      });
  },
}));

import { GET } from '../route';

function infoRequest(): Request {
  return new Request('http://localhost/api/exam/training-1/info');
}
function params() {
  return { params: Promise.resolve({ id: 'training-1' }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.role = 'staff';
  ctx.organizationId = 'org-1';
  prismaMock.training.findUnique.mockResolvedValue({
    id: 'training-1',
    title: 'SCORM Eğitimi',
    description: 'Açıklama',
    category: 'scorm',
    scormEntryPoint: 'index.html',
    scormVersion: '1.2',
    organizationId: 'org-1',
  });
});

describe('GET /api/exam/[id]/info — org izolasyonu + atama sahipliği', () => {
  it('eğitim yoksa 404 döner ve atama sorgulanmaz', async () => {
    prismaMock.training.findUnique.mockResolvedValue(null);

    const res = await GET(infoRequest(), params());

    expect(res.status).toBe(404);
    expect(prismaMock.trainingAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('staff farklı org eğitimi isterse 403 döner ve atama sorgulanmaz', async () => {
    prismaMock.training.findUnique.mockResolvedValue({
      id: 'training-1',
      title: 'SCORM Eğitimi',
      description: null,
      category: 'scorm',
      scormEntryPoint: 'index.html',
      scormVersion: '1.2',
      organizationId: 'other',
    });

    const res = await GET(infoRequest(), params());

    expect(res.status).toBe(403);
    expect(prismaMock.trainingAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('staff atanmışsa 200 döner ve gövde scormEntryPoint taşır', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });

    const res = await GET(infoRequest(), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scormEntryPoint).toBe('index.html');
    expect(body.scormVersion).toBe('1.2');
    expect(prismaMock.trainingAssignment.findFirst).toHaveBeenCalledOnce();
    const where = prismaMock.trainingAssignment.findFirst.mock.calls[0][0].where;
    expect(where.trainingId).toBe('training-1');
    expect(where.userId).toBe('staff-1');
  });

  it('staff atanmamışsa 403 döner', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue(null);

    const res = await GET(infoRequest(), params());

    expect(res.status).toBe(403);
  });

  it('super_admin farklı org eğitimini görebilir (200) ve atama sorgulanmaz', async () => {
    ctx.role = 'super_admin';
    prismaMock.training.findUnique.mockResolvedValue({
      id: 'training-1',
      title: 'SCORM Eğitimi',
      description: null,
      category: 'scorm',
      scormEntryPoint: 'index.html',
      scormVersion: '1.2',
      organizationId: 'other-org',
    });

    const res = await GET(infoRequest(), params());

    expect(res.status).toBe(200);
    expect(prismaMock.trainingAssignment.findFirst).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A1 — SCORM content route atama sahipliği (IDOR) koruması.
 *
 * Org izolasyonu tek başına yetmiyordu: aynı org'daki ama bu eğitime ATANMAMIŞ
 * personel SCORM paketinin dosyalarını çekebiliyordu. Bu test, 'staff' rolü için
 * atama yoksa 403 döndüğünü ve atama/üst-rol durumunda akışın S3'e geçtiğini kilitler.
 */

const { prismaMock, s3Mock, ctx } = vi.hoisted(() => ({
  prismaMock: {
    training: { findUnique: vi.fn() },
    trainingAssignment: { findFirst: vi.fn() },
  },
  s3Mock: { send: vi.fn() },
  ctx: { role: 'staff' as string, organizationId: 'org-1' },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/s3', () => ({ s3: s3Mock }));
vi.mock('@aws-sdk/client-s3', () => ({ GetObjectCommand: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/api-helpers', () => ({
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

function contentRequest(): Request {
  return new Request('http://localhost/api/exam/training-1/scorm/content/index.html');
}
function params() {
  return { params: Promise.resolve({ id: 'training-1', path: ['index.html'] }) };
}
function s3Body() {
  return {
    Body: (async function* () {
      yield new Uint8Array([1, 2, 3]);
    })(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.role = 'staff';
  ctx.organizationId = 'org-1';
  prismaMock.training.findUnique.mockResolvedValue({
    scormManifestPath: 'scorm/training-1/imsmanifest.xml',
    organizationId: 'org-1',
  });
});

describe('GET /scorm/content/[...path] — atama sahipliği (A1)', () => {
  it('staff atanmamışsa 403 döner ve S3 hiç çağrılmaz', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue(null);

    const res = await GET(contentRequest(), params());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('atanmamış');
    expect(s3Mock.send).not.toHaveBeenCalled();
  });

  it('staff atanmışsa içerik sunulur (S3 çağrılır)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });
    s3Mock.send.mockResolvedValue(s3Body());

    const res = await GET(contentRequest(), params());

    expect(res.status).toBe(200);
    expect(s3Mock.send).toHaveBeenCalledOnce();
    // Atama, doğru tenant+kullanıcı ile sorgulandı
    const where = prismaMock.trainingAssignment.findFirst.mock.calls[0][0].where;
    expect(where.trainingId).toBe('training-1');
    expect(where.userId).toBe('staff-1');
  });

  it('super_admin için atama kontrolü atlanır (önizleme) — atama sorgusu yapılmaz', async () => {
    ctx.role = 'super_admin';
    // super_admin başka org'a bile erişebilir; org guard da onu muaf tutuyor
    prismaMock.training.findUnique.mockResolvedValue({
      scormManifestPath: 'scorm/training-1/imsmanifest.xml',
      organizationId: 'other-org',
    });
    s3Mock.send.mockResolvedValue(s3Body());

    const res = await GET(contentRequest(), params());

    expect(res.status).toBe(200);
    expect(prismaMock.trainingAssignment.findFirst).not.toHaveBeenCalled();
  });
});

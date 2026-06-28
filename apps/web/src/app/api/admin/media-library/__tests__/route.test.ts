import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Medya Kütüphanesi route regresyon koruması:
 *  1. DELETE — DB satırı HER ZAMAN silinir; S3 nesnesi YALNIZ o s3Key'i kullanan
 *     hiçbir TrainingVideo yoksa silinir (referans-kontrolü). Kullanımdaki dosya
 *     asla silinmez → eğitimler çalışmaya devam eder.
 *  2. DELETE — başka org'un öğesi 403.
 *  3. POST — yalnız video/audio kabul; PDF/diğer reddedilir.
 *  4. GET — org-scope liste döner.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    mediaAsset: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    trainingVideo: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    organizationSubscription: { findFirst: vi.fn() },
  },
}));

const { deleteObjectMock } = vi.hoisted(() => ({ deleteObjectMock: vi.fn() }));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/redis', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/turkish-search', () => ({ turkishSearchIds: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/media-asset-url', () => ({
  resolveMediaAssetUrl: vi.fn().mockResolvedValue('signed://url'),
}));
vi.mock('@/lib/s3', () => ({
  deleteObject: deleteObjectMock,
  getUploadUrl: vi.fn().mockResolvedValue('https://s3/presigned'),
  videoKey: (org: string, scope: string, name: string) => `videos/${org}/${scope}/${name}`,
  audioKey: (org: string, scope: string, name: string) => `audio/${org}/${scope}/${name}`,
  getOrgStorageBytes: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  safePagination: (sp: URLSearchParams) => ({
    page: 1,
    limit: 50,
    skip: 0,
    search: sp.get('search') ?? '',
  }),
}));

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: <P>(
    handler: (ctx: {
      request: Request;
      params: P;
      dbUser: { id: string; role: string; organizationId: string };
      organizationId: string;
      audit: () => Promise<void>;
    }) => Promise<Response>
  ) => {
    return async (request: Request, ctx?: { params: Promise<P> }) => {
      return handler({
        request,
        params: ctx ? await ctx.params : ({} as P),
        dbUser: { id: 'admin-1', role: 'admin', organizationId: 'org-1' },
        organizationId: 'org-1',
        audit: vi.fn().mockResolvedValue(undefined),
      });
    };
  },
}));

import { GET, POST } from '../route';
import { DELETE } from '../[id]/route';

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/admin/media-library/[id] — referans-kontrollü S3', () => {
  it('kullanımda OLMAYAN dosya → DB satırı + S3 nesnesi silinir', async () => {
    prismaMock.mediaAsset.findUnique.mockResolvedValue({
      id: 'm1',
      title: 'X',
      organizationId: 'org-1',
      s3Key: 'videos/org-1/media-library/x.mp4',
    });
    prismaMock.trainingVideo.count.mockResolvedValue(0); // hiçbir eğitim kullanmıyor
    prismaMock.mediaAsset.delete.mockResolvedValue({});

    const res = await DELETE(
      jsonReq('http://x/api/admin/media-library/m1', 'DELETE'),
      params('m1')
    );

    expect(res.status).toBe(200);
    expect(prismaMock.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(deleteObjectMock).toHaveBeenCalledWith('videos/org-1/media-library/x.mp4');
  });

  it('KULLANIMDAKİ dosya → DB satırı silinir ama S3 nesnesine DOKUNULMAZ', async () => {
    prismaMock.mediaAsset.findUnique.mockResolvedValue({
      id: 'm1',
      title: 'X',
      organizationId: 'org-1',
      s3Key: 'videos/org-1/media-library/x.mp4',
    });
    prismaMock.trainingVideo.count.mockResolvedValue(2); // 2 eğitim kullanıyor
    prismaMock.mediaAsset.delete.mockResolvedValue({});

    const res = await DELETE(
      jsonReq('http://x/api/admin/media-library/m1', 'DELETE'),
      params('m1')
    );

    expect(res.status).toBe(200);
    expect(prismaMock.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it('S3 silme kararı, DB satırı silindikten SONRA sayılır (TOCTOU yarış-güvenli)', async () => {
    prismaMock.mediaAsset.findUnique.mockResolvedValue({
      id: 'm1',
      title: 'X',
      organizationId: 'org-1',
      s3Key: 'videos/org-1/media-library/x.mp4',
    });
    prismaMock.trainingVideo.count.mockResolvedValue(0);
    prismaMock.mediaAsset.delete.mockResolvedValue({});

    await DELETE(jsonReq('http://x/api/admin/media-library/m1', 'DELETE'), params('m1'));

    // Sıra kritik: önce mediaAsset.delete, SONRA trainingVideo.count. Aksi halde
    // (eski kod) silme ile sayım arasında bir eğitime eklenen asset'in kullanımdaki
    // S3 dosyası yanlışlıkla silinebilirdi ("hiçbir admin yüklemesi silinmez" ihlali).
    const deleteOrder = prismaMock.mediaAsset.delete.mock.invocationCallOrder[0];
    const countOrder = prismaMock.trainingVideo.count.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(countOrder);
  });

  it('başka org öğesi → 403, silinmez', async () => {
    prismaMock.mediaAsset.findUnique.mockResolvedValue({
      id: 'm1',
      title: 'X',
      organizationId: 'other-org',
      s3Key: 'k',
    });

    const res = await DELETE(
      jsonReq('http://x/api/admin/media-library/m1', 'DELETE'),
      params('m1')
    );

    expect(res.status).toBe(403);
    expect(prismaMock.mediaAsset.delete).not.toHaveBeenCalled();
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it('bulunamadı → 404', async () => {
    prismaMock.mediaAsset.findUnique.mockResolvedValue(null);
    const res = await DELETE(
      jsonReq('http://x/api/admin/media-library/m1', 'DELETE'),
      params('m1')
    );
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/media-library — tür kısıtı', () => {
  it('PDF reddedilir (yalnız video/audio)', async () => {
    const res = await POST(
      jsonReq('http://x/api/admin/media-library', 'POST', {
        files: [{ fileName: 'd.pdf', contentType: 'application/pdf', fileSize: 1000 }],
      })
    );
    expect(res.status).toBe(400);
    expect(prismaMock.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('video → presign + kayıt, uploadUrl döner', async () => {
    prismaMock.mediaAsset.create.mockResolvedValue({
      id: 'm-new',
      title: 'v',
      mediaType: 'video',
      createdAt: new Date(),
    });
    const res = await POST(
      jsonReq('http://x/api/admin/media-library', 'POST', {
        files: [
          { fileName: 'v.mp4', contentType: 'video/mp4', fileSize: 2048, durationSeconds: 120 },
        ],
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.results[0].uploadUrl).toBe('https://s3/presigned');
    expect(prismaMock.mediaAsset.create).toHaveBeenCalled();
  });
});

describe('GET /api/admin/media-library — org-scope liste', () => {
  it('org öğelerini döner', async () => {
    prismaMock.mediaAsset.findMany.mockResolvedValue([
      {
        id: 'm1',
        title: 'A',
        description: null,
        mediaType: 'video',
        s3Key: 'k',
        durationSeconds: 60,
        fileSizeBytes: BigInt(1000),
        createdAt: new Date(),
      },
    ]);
    prismaMock.mediaAsset.count.mockResolvedValue(1);
    prismaMock.trainingVideo.groupBy.mockResolvedValue([]);

    const res = await GET(jsonReq('http://x/api/admin/media-library', 'GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].fileSizeBytes).toBe(1000); // BigInt → Number
  });
});

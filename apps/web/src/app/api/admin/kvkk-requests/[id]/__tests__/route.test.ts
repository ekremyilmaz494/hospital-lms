import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Admin KVKK-Requests PATCH — personelin açtığı hak talebini admin sonuçlandırır.
 * Bu testler KVKK m.13 yanıt iş akışının sözleşmesini kilitler: durum/yanıt yazımı,
 * org izolasyonu, terminal-talep koruması, tamamla/red için not zorunluluğu, personele bildirim.
 */

const { prismaMock, txMock, checkRateLimitMock } = vi.hoisted(() => {
  const txMock = {
    kvkkRequest: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
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
    }) => Promise<Response>,
  ) => {
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
  return new Request('http://localhost/api/admin/kvkk-requests/req-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const call = (body: unknown) => PATCH(patchRequest(body), { params: Promise.resolve({ id: 'req-1' }) } as never);

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue(true);
  txMock.kvkkRequest.findUnique.mockResolvedValue({
    id: 'req-1',
    status: 'pending',
    organizationId: 'org-1',
    userId: 'user-1',
    requestType: 'deletion',
  });
});

describe('PATCH /api/admin/kvkk-requests/[id]', () => {
  it('completed: durum + yanıt + respondedById + completedAt yazar, personele bildirir', async () => {
    const res = await call({ status: 'completed', responseNote: 'Verileriniz silindi.' });
    expect(res.status).toBe(200);
    const upd = txMock.kvkkRequest.update.mock.calls[0][0];
    expect(upd.where).toEqual({ id: 'req-1' });
    expect(upd.data.status).toBe('completed');
    expect(upd.data.responseNote).toBe('Verileriniz silindi.');
    expect(upd.data.respondedById).toBe('admin-1');
    expect(upd.data.completedAt).toBeInstanceOf(Date);
    const notif = txMock.notification.create.mock.calls[0][0];
    expect(notif.data.userId).toBe('user-1');
    expect(notif.data.type).toBe('info');
  });

  it('in_progress: not olmadan geçerli, completedAt null kalır', async () => {
    const res = await call({ status: 'in_progress' });
    expect(res.status).toBe(200);
    const upd = txMock.kvkkRequest.update.mock.calls[0][0];
    expect(upd.data.status).toBe('in_progress');
    expect(upd.data.completedAt).toBeNull();
    // responseNote verilmedi → mevcut not korunur (undefined)
    expect(upd.data.responseNote).toBeUndefined();
  });

  it('rejected: yanıt notu yoksa 400 (tebliğ için gerekçe zorunlu)', async () => {
    const res = await call({ status: 'rejected' });
    expect(res.status).toBe(400);
    expect(txMock.kvkkRequest.update).not.toHaveBeenCalled();
  });

  it('başka org talebine 403 (tenant izolasyonu)', async () => {
    txMock.kvkkRequest.findUnique.mockResolvedValueOnce({
      id: 'req-1', status: 'pending', organizationId: 'org-2', userId: 'user-x', requestType: 'access',
    });
    const res = await call({ status: 'completed', responseNote: 'test yanıtı' });
    expect(res.status).toBe(403);
    expect(txMock.kvkkRequest.update).not.toHaveBeenCalled();
  });

  it('zaten sonuçlanmış talep tekrar yazılamaz (400)', async () => {
    txMock.kvkkRequest.findUnique.mockResolvedValueOnce({
      id: 'req-1', status: 'completed', organizationId: 'org-1', userId: 'user-1', requestType: 'access',
    });
    const res = await call({ status: 'rejected', responseNote: 'geç kalınmış' });
    expect(res.status).toBe(400);
    expect(txMock.kvkkRequest.update).not.toHaveBeenCalled();
  });

  it('geçersiz status değeri 400', async () => {
    const res = await call({ status: 'garbage', responseNote: 'x' });
    expect(res.status).toBe(400);
  });
});

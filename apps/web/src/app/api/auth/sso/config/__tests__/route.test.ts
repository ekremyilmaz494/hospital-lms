import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * SSO Config PUT — ssoDefaultRole allow-list (privilege-escalation regresyon kilidi).
 *
 * **KÖK NEDEN:** PUT handler body'den gelen ssoDefaultRole'u doğrulamadan DB'ye
 * yazıyordu. UserRole enum'u super_admin'i içerdiğinden Prisma yazımı engellemiyor;
 * sonra sso/callback bu değeri auto-provision rolü olarak kullanıp (isOrgUser=false →
 * organizationId=null) platform-geneli super_admin üretebiliyordu. Tek-hastane
 * scope'lu bir admin böylece kendini/başkasını super_admin'e yükseltebilirdi.
 *
 * **KARAR:** ssoDefaultRole yalnız ['admin','staff'] olabilir; başka değer → 400,
 * DB'ye yazım YOK. (callback tarafında ayrıca defense-in-depth: 'admin' dışı her değer
 * 'staff'a düşer.) Bu test birincil kapıyı (config PUT) kilitler.
 */

const { prismaMock, encryptMock } = vi.hoisted(() => ({
  prismaMock: {
    organization: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({}),
    },
  },
  encryptMock: vi.fn((s: string) => `enc:${s}`),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/crypto', () => ({ encrypt: encryptMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

vi.mock('@/lib/api-handler', () => ({
  withApiHandler: (
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

import { PUT } from '../route';

function putRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/sso/config', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SSO config PUT — ssoDefaultRole allow-list', () => {
  it("ssoDefaultRole='super_admin' → 400 ve organization.update ÇAĞRILMAZ (privilege escalation engellendi)", async () => {
    const res = await PUT(putRequest({ ssoEnabled: true, ssoDefaultRole: 'super_admin' }));
    expect(res.status).toBe(400);
    expect(prismaMock.organization.update).not.toHaveBeenCalled();
  });

  it("geçersiz rol ('owner') → 400, update yok", async () => {
    const res = await PUT(putRequest({ ssoDefaultRole: 'owner' }));
    expect(res.status).toBe(400);
    expect(prismaMock.organization.update).not.toHaveBeenCalled();
  });

  it("ssoDefaultRole='admin' → 200 ve update data.ssoDefaultRole='admin'", async () => {
    const res = await PUT(putRequest({ ssoDefaultRole: 'admin' }));
    expect(res.status).toBe(200);
    expect(prismaMock.organization.update).toHaveBeenCalledTimes(1);
    const arg = prismaMock.organization.update.mock.calls[0][0] as { data: { ssoDefaultRole?: string } };
    expect(arg.data.ssoDefaultRole).toBe('admin');
  });

  it("ssoDefaultRole='staff' → 200", async () => {
    const res = await PUT(putRequest({ ssoDefaultRole: 'staff' }));
    expect(res.status).toBe(200);
    expect(prismaMock.organization.update).toHaveBeenCalledTimes(1);
  });

  it('ssoDefaultRole verilmezse → 200 ve data içinde ssoDefaultRole yazılmaz (mevcut değeri korur)', async () => {
    const res = await PUT(putRequest({ ssoEnabled: true }));
    expect(res.status).toBe(200);
    const arg = prismaMock.organization.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect('ssoDefaultRole' in arg.data).toBe(false);
  });
});

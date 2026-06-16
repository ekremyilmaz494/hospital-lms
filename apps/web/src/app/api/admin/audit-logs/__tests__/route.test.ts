import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Admin Audit-Logs GET — pagination clamp (DoS / NaN / negatif kilidi).
 *
 * Kullanıcı kontrollü take/skip clamp'siz Prisma'ya akıyordu: ?limit=büyük → sınırsız
 * fetch (ağır audit tablosunda DoS), ?limit=abc → take:NaN (Prisma patlar), ?page=0 →
 * negatif skip. Clamp: limit [1,100] (varsayılan 50 korunur), page >= 1.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    auditLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));
vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (
    handler: (ctx: { request: Request; organizationId: string }) => Promise<Response>
  ) => {
    return async (request: Request) => handler({ request, organizationId: 'org-1' });
  },
}));

import { GET } from '../route';

function getReq(qs: string): Request {
  return new Request(`http://localhost/api/admin/audit-logs${qs}`);
}

function lastFindManyArg() {
  const calls = prismaMock.auditLog.findMany.mock.calls;
  return calls[calls.length - 1][0] as { skip: number; take: number };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.auditLog.findMany.mockResolvedValue([]);
  prismaMock.auditLog.count.mockResolvedValue(0);
});

describe('Admin audit-logs GET — pagination clamp', () => {
  it('aşırı büyük limit → take 100\'e clamp (sınırsız fetch engellenir)', async () => {
    await GET(getReq('?limit=10000000'));
    expect(lastFindManyArg().take).toBe(100);
  });

  it('limit=abc (NaN) → take varsayılan 50', async () => {
    await GET(getReq('?limit=abc'));
    expect(lastFindManyArg().take).toBe(50);
  });

  it('page=0 → skip 0 (page en az 1)', async () => {
    await GET(getReq('?page=0&limit=20'));
    expect(lastFindManyArg().skip).toBe(0);
  });

  it('geçerli page=3 limit=20 → skip 40', async () => {
    await GET(getReq('?page=3&limit=20'));
    const arg = lastFindManyArg();
    expect(arg.skip).toBe(40);
    expect(arg.take).toBe(20);
  });
});

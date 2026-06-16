import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@/generated/prisma/client';

/**
 * Admin Departments POST — check-then-create yarışında P2002 → 409 (generic 500 değil).
 *
 * findFirst kontrolü ile create arasında eşzamanlı istek partial unique index'e takılıp
 * P2002 fırlatabiliyordu; try/catch olmadığı için withApiHandler generic 500 dönüyordu.
 * Artık P2002 yakalanıp amaçlanan 409 döner; P2002 dışı hatalar yeniden fırlatılır.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    department: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/redis', () => ({ invalidateOrgCache: vi.fn().mockResolvedValue(undefined) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/validations', () => ({
  createDepartmentSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => req.json().catch(() => null),
}));
vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (
    handler: (ctx: { request: Request; organizationId: string; audit: (p: unknown) => Promise<void> }) => Promise<Response>
  ) => {
    return async (request: Request) => handler({ request, organizationId: 'org-1', audit: vi.fn() });
  },
}));

import { POST } from '../route';

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/departments', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.department.findFirst.mockResolvedValue(null); // existing kontrolü geçer (kök dept)
});

describe('Admin departments POST — P2002 yarış davranışı', () => {
  it('create P2002 fırlatırsa 409 döner (generic 500 değil)', async () => {
    prismaMock.department.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.0.0',
      })
    );

    const res = await POST(postRequest({ name: 'Kardiyoloji' }));
    expect(res.status).toBe(409);
  });

  it('P2002 dışı hata yeniden fırlatılır (withApiHandler 500 üretir, sessizce yutulmaz)', async () => {
    prismaMock.department.create.mockRejectedValue(new Error('beklenmeyen DB hatası'));
    await expect(POST(postRequest({ name: 'Nöroloji' }))).rejects.toThrow('beklenmeyen DB hatası');
  });

  it('başarılı create → 201', async () => {
    prismaMock.department.create.mockResolvedValue({ id: 'dept-1', name: 'Kardiyoloji', _count: { users: 0 } });
    const res = await POST(postRequest({ name: 'Kardiyoloji' }));
    expect(res.status).toBe(201);
  });
});

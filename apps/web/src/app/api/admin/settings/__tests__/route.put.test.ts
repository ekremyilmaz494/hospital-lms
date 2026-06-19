import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (
    handler: (ctx: { request: Request; organizationId: string; audit: (p: unknown) => Promise<void> }) => Promise<Response>,
  ) => {
    return async (request: Request) =>
      handler({ request, organizationId: 'org-1', audit: vi.fn().mockResolvedValue(undefined) })
  },
}))

const orgFindUnique = vi.fn()
const orgUpdate = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: (...a: unknown[]) => orgFindUnique(...a),
      update: (...a: unknown[]) => orgUpdate(...a),
    },
  },
}))

import { PUT } from '../route'

function putReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/admin/settings — bildirim tercihleri persistence (#2)', () => {
  beforeEach(() => {
    orgFindUnique.mockReset()
    orgUpdate.mockReset()
    orgFindUnique.mockResolvedValue({ name: 'Eski', email: null, phone: null })
  })

  it('4 bildirim alanını update data içine yazar', async () => {
    orgUpdate.mockResolvedValue({
      name: 'Eski', logoUrl: null, email: null, phone: null, address: null,
      sessionTimeout: 30, defaultPassingScore: 70, defaultMaxAttempts: 3, defaultExamDuration: 30,
      brandColor: '#0F172A', secondaryColor: '#3B82F6', loginBannerUrl: null, customDomain: null,
      emailNotifications: false, reminderDaysBefore: 7, notifyOnComplete: false, notifyOnFail: true,
    })

    const res = await PUT(putReq({
      emailNotifications: false,
      reminderDaysBefore: 7,
      notifyOnComplete: false,
      notifyOnFail: true,
    }) as never)
    const data = await res.json()

    expect(res.status).toBe(200)
    // Eskiden zod şeması bu alanları strip ediyordu → update'e hiç ulaşmıyordu (dead-state).
    expect(orgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailNotifications: false,
          reminderDaysBefore: 7,
          notifyOnComplete: false,
          notifyOnFail: true,
        }),
      }),
    )
    expect(data.reminderDaysBefore).toBe(7)
  })

  it('reminderDaysBefore aralık dışı (>30) → 400', async () => {
    const res = await PUT(putReq({ reminderDaysBefore: 99 }) as never)
    expect(res.status).toBe(400)
    expect(orgUpdate).not.toHaveBeenCalled()
  })
})

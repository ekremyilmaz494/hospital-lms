import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/api-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-helpers')>('@/lib/api-helpers')
  return {
    ...actual,
    getAuthUser: vi.fn(),
    getAuthUserStrict: vi.fn(),
    requireRole: vi.fn(),
    checkWritePermission: vi.fn().mockResolvedValue(null),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
    jsonResponse: vi.fn((data: unknown, status = 200) => Response.json(data, { status })),
    errorResponse: vi.fn((msg: string, status = 400) => Response.json({ error: msg }, { status })),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { GET, PATCH } from '../route'
import { getAuthUser, requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockRequireRole = vi.mocked(requireRole)
const mockNotificationFindMany = vi.mocked(prisma.notification.findMany)
const mockNotificationCount = vi.mocked(prisma.notification.count)
const mockNotificationUpdateMany = vi.mocked(prisma.notification.updateMany)

/** Helper to build a Request with optional query params */
function createRequest(method: string, params?: Record<string, string>) {
  const url = new URL('http://localhost/api/staff/notifications')
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }
  return new Request(url.toString(), { method })
}

const staffUser = {
  user: { id: 'staff-1' },
  dbUser: {
    id: 'staff-1',
    role: 'staff',
    organizationId: 'org-1',
    isActive: true,
  },
  error: null,
} as never

describe('GET /api/staff/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue({
      user: null,
      dbUser: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await GET(createRequest('GET'))
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns notifications with unread count', async () => {
    mockGetAuthUser.mockResolvedValue(staffUser)
    mockRequireRole.mockReturnValue(null)

    const mockNotifications = [
      {
        id: 'notif-1',
        title: 'Yeni egitim atandi',
        message: 'Temel Hijyen egitimi atandi',
        isRead: false,
        createdAt: new Date('2026-03-28T10:00:00Z'),
        userId: 'staff-1',
        organizationId: 'org-1',
      },
      {
        id: 'notif-2',
        title: 'Sertifika hazir',
        message: 'Sertifikaniz hazirlandi',
        isRead: true,
        createdAt: new Date('2026-03-27T10:00:00Z'),
        userId: 'staff-1',
        organizationId: 'org-1',
      },
    ]

    mockNotificationFindMany.mockResolvedValue(mockNotifications as never)
    mockNotificationCount.mockResolvedValue(1 as never)

    const response = await GET(createRequest('GET'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.notifications).toHaveLength(2)
    expect(data.unreadCount).toBe(1)
  })

  it('filters by organizationId for multi-tenant isolation', async () => {
    mockGetAuthUser.mockResolvedValue(staffUser)
    mockRequireRole.mockReturnValue(null)

    mockNotificationFindMany.mockResolvedValue([] as never)
    mockNotificationCount.mockResolvedValue(0 as never)

    await GET(createRequest('GET'))

    // Verify organizationId is included in the query
    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'staff-1',
          organizationId: 'org-1',
        }),
      })
    )

    expect(mockNotificationCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'staff-1',
          organizationId: 'org-1',
          isRead: false,
        }),
      })
    )
  })
})

describe('PATCH /api/staff/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks single notification as read with valid UUID', async () => {
    mockGetAuthUser.mockResolvedValue(staffUser)
    mockRequireRole.mockReturnValue(null)

    const validUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    mockNotificationUpdateMany.mockResolvedValue({ count: 1 } as never)

    const response = await PATCH(createRequest('PATCH', { id: validUUID }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: {
        id: validUUID,
        userId: 'staff-1',
        organizationId: 'org-1',
      },
      data: { isRead: true },
    })
  })

  it('returns 400 for invalid notification ID format', async () => {
    mockGetAuthUser.mockResolvedValue(staffUser)
    mockRequireRole.mockReturnValue(null)

    const response = await PATCH(createRequest('PATCH', { id: 'not-a-valid-uuid' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Geçersiz bildirim ID')
  })

  it('marks all notifications as read when no id provided', async () => {
    mockGetAuthUser.mockResolvedValue(staffUser)
    mockRequireRole.mockReturnValue(null)

    // Snapshot-based mark-all: route first fetches unread IDs, then updates by ID list
    mockNotificationFindMany.mockResolvedValue([
      { id: 'notif-1' },
      { id: 'notif-2' },
    ] as never)
    mockNotificationUpdateMany.mockResolvedValue({ count: 2 } as never)

    const response = await PATCH(createRequest('PATCH'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify findMany was called to get unread notification IDs
    expect(mockNotificationFindMany).toHaveBeenCalledWith({
      where: {
        userId: 'staff-1',
        organizationId: 'org-1',
        isRead: false,
      },
      select: { id: true },
    })

    // Verify updateMany was called with the fetched IDs
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['notif-1', 'notif-2'] } },
      data: { isRead: true },
    })
  })
})

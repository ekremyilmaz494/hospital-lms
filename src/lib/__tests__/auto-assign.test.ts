import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    departmentTrainingRule: { findMany: vi.fn() },
    trainingAssignment: { findMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { autoAssignByDepartment } from '../auto-assign'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

const mockRuleFindMany = prisma.departmentTrainingRule.findMany as ReturnType<typeof vi.fn>
const mockAssignmentFindMany = prisma.trainingAssignment.findMany as ReturnType<typeof vi.fn>
const mockCreateMany = prisma.trainingAssignment.createMany as ReturnType<typeof vi.fn>
const mockAuditCreate = prisma.auditLog.create as ReturnType<typeof vi.fn>

const userId = 'user-1'
const departmentId = 'dept-1'
const organizationId = 'org-1'
const assignedById = 'admin-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('autoAssignByDepartment', () => {
  it('departman için kural yoksa 0 döner', async () => {
    mockRuleFindMany.mockResolvedValue([])

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(0)
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('aktif ve süresi dolmamış eğitimler için atama oluşturur', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    mockRuleFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: true, endDate: futureDate },
      },
    ])
    mockAssignmentFindMany.mockResolvedValue([])
    mockCreateMany.mockResolvedValue({ count: 1 })
    mockAuditCreate.mockResolvedValue({ id: 'audit-1' })

    const result = await autoAssignByDepartment(userId, departmentId, organizationId, assignedById)

    expect(result).toBe(1)
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        {
          trainingId: 'training-1',
          userId,
          status: 'assigned',
          assignedById,
        },
      ],
      skipDuplicates: true,
    })
  })

  it('aktif olmayan eğitimleri atlar', async () => {
    mockRuleFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: false, endDate: null },
      },
    ])

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(0)
    expect(mockAssignmentFindMany).not.toHaveBeenCalled()
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('süresi dolmuş eğitimleri atlar', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    mockRuleFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: true, endDate: pastDate },
      },
    ])

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(0)
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('zaten atanmış eğitimleri atlar', async () => {
    mockRuleFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: true, endDate: null },
      },
    ])
    mockAssignmentFindMany.mockResolvedValue([{ trainingId: 'training-1' }])

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(0)
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('atama yapıldığında audit log oluşturur', async () => {
    mockRuleFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: true, endDate: null },
      },
    ])
    mockAssignmentFindMany.mockResolvedValue([])
    mockCreateMany.mockResolvedValue({ count: 1 })
    mockAuditCreate.mockResolvedValue({ id: 'audit-1' })

    await autoAssignByDepartment(userId, departmentId, organizationId, assignedById)

    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'auto_assign',
        entityType: 'training_assignment',
        entityId: departmentId,
        organizationId,
        userId: assignedById,
        newData: expect.objectContaining({
          assignedCount: 1,
          targetUserId: userId,
          departmentId,
        }),
      }),
    })
  })

  it('doğru atama sayısını döner', async () => {
    mockRuleFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: true, endDate: null },
      },
      {
        trainingId: 'training-2',
        training: { id: 'training-2', isActive: true, endDate: null },
      },
      {
        trainingId: 'training-3',
        training: { id: 'training-3', isActive: true, endDate: null },
      },
    ])
    mockAssignmentFindMany.mockResolvedValue([])
    mockCreateMany.mockResolvedValue({ count: 3 })
    mockAuditCreate.mockResolvedValue({ id: 'audit-1' })

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(3)
    expect(mockCreateMany).toHaveBeenCalledTimes(1)
  })

  it('atama hatalarını loglar ve devam eder', async () => {
    mockRuleFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: true, endDate: null },
      },
      {
        trainingId: 'training-2',
        training: { id: 'training-2', isActive: true, endDate: null },
      },
    ])
    mockAssignmentFindMany.mockResolvedValue([])
    mockCreateMany.mockRejectedValue(new Error('DB error'))

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(0)
    expect(logger.warn).toHaveBeenCalledWith(
      'AutoAssign',
      expect.stringContaining(userId),
      'DB error'
    )
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('../prisma', () => ({
  prisma: {
    departmentTrainingRule: { findMany: vi.fn() },
    trainingAssignment: { findUnique: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

// Mock logger
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { autoAssignByDepartment } from '../auto-assign'
import { prisma } from '../prisma'
import { logger } from '../logger'

const mockFindMany = prisma.departmentTrainingRule.findMany as ReturnType<typeof vi.fn>
const mockFindUnique = prisma.trainingAssignment.findUnique as ReturnType<typeof vi.fn>
const mockCreate = prisma.trainingAssignment.create as ReturnType<typeof vi.fn>
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
    mockFindMany.mockResolvedValue([])

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('aktif ve süresi dolmamış eğitimler için atama oluşturur', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    mockFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: true, endDate: futureDate },
      },
    ])
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 'assignment-1' })
    mockAuditCreate.mockResolvedValue({ id: 'audit-1' })

    const result = await autoAssignByDepartment(userId, departmentId, organizationId, assignedById)

    expect(result).toBe(1)
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        trainingId: 'training-1',
        userId,
        status: 'assigned',
        assignedById,
      },
    })
  })

  it('aktif olmayan eğitimleri atlar', async () => {
    mockFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: false, endDate: null },
      },
    ])

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(0)
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('süresi dolmuş eğitimleri atlar', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    mockFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: true, endDate: pastDate },
      },
    ])

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('zaten atanmış eğitimleri atlar', async () => {
    mockFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: true, endDate: null },
      },
    ])
    mockFindUnique.mockResolvedValue({ id: 'existing-assignment' })

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('atama yapıldığında audit log oluşturur', async () => {
    mockFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: true, endDate: null },
      },
    ])
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 'assignment-1' })
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
    mockFindMany.mockResolvedValue([
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
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 'assignment' })
    mockAuditCreate.mockResolvedValue({ id: 'audit-1' })

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(3)
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  it('atama hatalarını loglar ve devam eder', async () => {
    mockFindMany.mockResolvedValue([
      {
        trainingId: 'training-1',
        training: { id: 'training-1', isActive: true, endDate: null },
      },
      {
        trainingId: 'training-2',
        training: { id: 'training-2', isActive: true, endDate: null },
      },
    ])
    mockFindUnique.mockResolvedValue(null)
    mockCreate
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ id: 'assignment-2' })
    mockAuditCreate.mockResolvedValue({ id: 'audit-1' })

    const result = await autoAssignByDepartment(userId, departmentId, organizationId)

    expect(result).toBe(1)
    expect(logger.warn).toHaveBeenCalledWith(
      'AutoAssign',
      expect.stringContaining('training-1'),
      'DB error'
    )
  })
})

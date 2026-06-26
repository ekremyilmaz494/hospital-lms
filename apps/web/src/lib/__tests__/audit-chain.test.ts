import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * createAuditLog — hash zinciri ATOMİK + DETERMİNİSTİK kurulmalı (regresyon).
 * $transaction içinde advisory kilit alınır, son hash'e bağlanır ve createdAt
 * kesinlikle artırılır (aynı-ms çakışması → doğrulamada "zincir bozuldu" yanılması).
 */

const txState = {
  executeRaw: vi.fn().mockResolvedValue(undefined),
  findFirst: vi.fn(),
  create: vi.fn().mockResolvedValue({}),
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        $executeRaw: (...a: unknown[]) => txState.executeRaw(...a),
        auditLog: {
          findFirst: (...a: unknown[]) => txState.findFirst(...a),
          create: (...a: unknown[]) => txState.create(...a),
        },
      }),
  },
}))

import { createAuditLog, computeAuditHash } from '@/lib/api-helpers'

describe('createAuditLog — atomik + deterministik zincir', () => {
  beforeEach(() => {
    txState.executeRaw.mockClear()
    txState.findFirst.mockReset()
    txState.create.mockClear()
  })

  it('advisory kilit alır, son hash\'e bağlar ve createdAt\'i artırır', async () => {
    const lastCreatedAt = new Date(Date.UTC(2030, 0, 1)) // gelecekte → bump kesin tetiklenir
    txState.findFirst.mockResolvedValue({ hash: 'H0', createdAt: lastCreatedAt })

    await createAuditLog({
      organizationId: 'org1',
      userId: 'u1',
      action: 'create',
      entityType: 'training',
      entityId: 'e1',
    })

    expect(txState.executeRaw).toHaveBeenCalled() // pg_advisory_xact_lock
    expect(txState.create).toHaveBeenCalledTimes(1)

    const data = txState.create.mock.calls[0][0].data
    expect(data.prevHash).toBe('H0')
    // createdAt kesinlikle artан: son kayıt + 1 ms
    expect(data.createdAt.getTime()).toBe(lastCreatedAt.getTime() + 1)
    // hash, doğrulamayla aynı alanlardan hesaplanan değere eşit
    const expected = computeAuditHash({
      prevHash: 'H0',
      action: 'create',
      entityType: 'training',
      entityId: 'e1',
      userId: 'u1',
      createdAt: data.createdAt.toISOString(),
    })
    expect(data.hash).toBe(expected)
  })

  it('ilk kayıt (önceki yok) → prevHash null, hash üretilir', async () => {
    txState.findFirst.mockResolvedValue(null)

    await createAuditLog({ organizationId: 'org2', action: 'login', entityType: 'user' })

    const data = txState.create.mock.calls[0][0].data
    expect(data.prevHash).toBeNull()
    expect(typeof data.hash).toBe('string')
    expect(data.hash).toHaveLength(64) // sha256 hex
  })
})

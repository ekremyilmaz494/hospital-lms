import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMembershipFindMany = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: { organizationMembership: { findMany: (...a: unknown[]) => mockMembershipFindMany(...a) } },
}))

import { getStaffOrgIds } from '../staff-orgs'

/**
 * getStaffOrgIds — ortak personelin bağlı olduğu tüm hastaneler. Bu bozulursa ya doktor
 * ikinci hastanesindeki eğitimi göremez/tamamlayamaz, ya da tekil-org davranışı değişip
 * mevcut müşterileri etkiler.
 */
describe('getStaffOrgIds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('üyelik yoksa yalnız primary org döner (tekil-org = INERT)', async () => {
    mockMembershipFindMany.mockResolvedValue([])
    const ids = await getStaffOrgIds('u1', 'orgA')
    expect(ids).toEqual(['orgA'])
  })

  it('primary + aktif üyelik org\'larını birleştirir', async () => {
    mockMembershipFindMany.mockResolvedValue([{ organizationId: 'orgB' }, { organizationId: 'orgC' }])
    const ids = await getStaffOrgIds('u1', 'orgA')
    expect(ids).toEqual(['orgA', 'orgB', 'orgC'])
  })

  it('yalnız AKTİF üyelikleri sorgular (isActive:true)', async () => {
    mockMembershipFindMany.mockResolvedValue([])
    await getStaffOrgIds('u1', 'orgA')
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isActive: true },
      select: { organizationId: true },
    })
  })

  it('primary ile çakışan üyeliği tekilleştirir (Set — çift org üretmez)', async () => {
    mockMembershipFindMany.mockResolvedValue([{ organizationId: 'orgA' }, { organizationId: 'orgB' }])
    const ids = await getStaffOrgIds('u1', 'orgA')
    expect(ids).toEqual(['orgA', 'orgB'])
  })
})

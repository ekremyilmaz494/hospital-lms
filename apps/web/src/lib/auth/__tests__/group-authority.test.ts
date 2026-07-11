import { describe, it, expect } from 'vitest'
import { hasGroupAuthority, extractGroupClaims } from '../group-authority'

describe('hasGroupAuthority', () => {
  it('group_owner=true + geçerli groupId → grup yöneticisi', () => {
    expect(hasGroupAuthority({ groupOwner: true, groupId: 'grp-1' })).toBe(true)
  })

  it('group_owner=true ama groupId yok → yetki YOK (fail-closed)', () => {
    expect(hasGroupAuthority({ groupOwner: true, groupId: null })).toBe(false)
    expect(hasGroupAuthority({ groupOwner: true, groupId: '' })).toBe(false)
    expect(hasGroupAuthority({ groupOwner: true })).toBe(false)
  })

  it('groupId var ama group_owner=false/yok → yetki YOK', () => {
    expect(hasGroupAuthority({ groupOwner: false, groupId: 'grp-1' })).toBe(false)
    expect(hasGroupAuthority({ groupId: 'grp-1' })).toBe(false)
    expect(hasGroupAuthority({ groupOwner: null, groupId: 'grp-1' })).toBe(false)
  })

  it('boş/null/undefined giriş → yetki YOK (fail-closed)', () => {
    expect(hasGroupAuthority(null)).toBe(false)
    expect(hasGroupAuthority(undefined)).toBe(false)
    expect(hasGroupAuthority({})).toBe(false)
  })
})

describe('extractGroupClaims', () => {
  it('app_metadata.group_owner=true + group_id → doğru çıkarır', () => {
    expect(extractGroupClaims({ group_owner: true, group_id: 'grp-1' })).toEqual({
      groupOwner: true,
      groupId: 'grp-1',
    })
  })

  it('string "true" varyantına toleranslı', () => {
    expect(extractGroupClaims({ group_owner: 'true', group_id: 'grp-1' })).toEqual({
      groupOwner: true,
      groupId: 'grp-1',
    })
  })

  it('yok / false / bozuk → groupOwner=false, groupId=null (fail-closed)', () => {
    expect(extractGroupClaims({})).toEqual({ groupOwner: false, groupId: null })
    expect(extractGroupClaims({ group_owner: false })).toEqual({ groupOwner: false, groupId: null })
    expect(extractGroupClaims({ group_owner: 1, group_id: 42 })).toEqual({ groupOwner: false, groupId: null })
    expect(extractGroupClaims({ group_owner: true, group_id: '' })).toEqual({ groupOwner: true, groupId: null })
    expect(extractGroupClaims(null)).toEqual({ groupOwner: false, groupId: null })
    expect(extractGroupClaims(undefined)).toEqual({ groupOwner: false, groupId: null })
  })
})

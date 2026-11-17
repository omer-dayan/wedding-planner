import { describe, expect, it } from 'vitest'
import { assignedRole, canEditGuest, isRestrictedMember, placementForRole, sideForRole } from './roles.ts'

const wedding = {
  ownerEmail: 'omerxdayan1@gmail.com',
  memberRoles: { 'moti@example.com': 'groom_brother' },
}

describe('wedding roles', () => {
  it('maps each role to a side and treats a missing owner role as groom', () => {
    expect(sideForRole('groom_sister')).toBe('groom')
    expect(sideForRole('bride_father')).toBe('bride')
    expect(assignedRole({ ownerEmail: 'omerxdayan1@gmail.com' }, 'OmerXDayan1@gmail.com')).toBe('groom')
    expect(assignedRole(wedding, 'moti@example.com')).toBe('groom_brother')
  })

  it('stamps side and sub-side from the member role', () => {
    expect(placementForRole('groom')).toEqual({ side: 'groom', subSide: 'none' })
    expect(placementForRole(null)).toEqual({ side: 'groom', subSide: 'none' })
    expect(placementForRole('bride_mother')).toEqual({ side: 'bride', subSide: 'parents' })
    expect(placementForRole('groom_father')).toEqual({ side: 'groom', subSide: 'parents' })
    expect(placementForRole('groom_brother')).toEqual({ side: 'groom', subSide: 'brother' })
    expect(placementForRole('bride_sister')).toEqual({ side: 'bride', subSide: 'sister' })
  })

  it('lets parents and siblings change only guests of their own side and sub-side', () => {
    expect(isRestrictedMember(wedding, 'moti@example.com')).toBe(true)
    expect(canEditGuest(wedding, 'moti@example.com', { side: 'groom', subSide: 'brother' })).toBe(true)
    expect(canEditGuest(wedding, 'moti@example.com', { side: 'groom', subSide: 'parents' })).toBe(false)
    expect(canEditGuest(wedding, 'moti@example.com', { side: 'bride', subSide: 'brother' })).toBe(false)
    expect(canEditGuest(wedding, 'moti@example.com', { side: null, subSide: 'none' })).toBe(false)
    expect(canEditGuest(wedding, 'omerxdayan1@gmail.com', { side: null })).toBe(true)
    expect(isRestrictedMember({ ownerEmail: 'owner@example.com', memberRoles: { 'owner@example.com': 'groom' } }, 'owner@example.com')).toBe(false)
    expect(isRestrictedMember({ ownerEmail: 'owner@example.com', memberRoles: { 'a@example.com': 'bride' } }, 'a@example.com')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { assignedRole, canEditGuest, isRestrictedMember, sideForRole } from './roles.ts'

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

  it('lets parents and siblings change only guests of their own role', () => {
    expect(isRestrictedMember(wedding, 'moti@example.com')).toBe(true)
    expect(canEditGuest(wedding, 'moti@example.com', { role: 'groom_brother' })).toBe(true)
    expect(canEditGuest(wedding, 'moti@example.com', { role: 'groom' })).toBe(false)
    expect(canEditGuest(wedding, 'moti@example.com', { role: null })).toBe(false)
    expect(canEditGuest(wedding, 'omerxdayan1@gmail.com', { role: null })).toBe(true)
    expect(isRestrictedMember({ ownerEmail: 'owner@example.com', memberRoles: { 'owner@example.com': 'groom' } }, 'owner@example.com')).toBe(false)
    expect(isRestrictedMember({ ownerEmail: 'owner@example.com', memberRoles: { 'a@example.com': 'bride' } }, 'a@example.com')).toBe(false)
  })
})

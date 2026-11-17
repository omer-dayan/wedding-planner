import { describe, expect, it } from 'vitest'
import { addMemberEmail, chooseWedding, displayMembers, removeMemberEmail, type Wedding } from './members.ts'

function wedding(overrides: Partial<Wedding>): Wedding {
  return {
    id: 'w1',
    name: 'החתונה שלנו',
    ownerEmail: 'owner@example.com',
    memberEmails: ['owner@example.com'],
    memberRoles: { 'owner@example.com': 'groom' },
    weddingDate: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('member allowlist', () => {
  it('adds a partner once, keeps the owner, and refuses to remove the owner', () => {
    const added = addMemberEmail(['Owner@Example.com'], 'Owner@Example.com', 'Partner@Example.com')
    expect(added.map((email) => email.toLowerCase())).toEqual(['owner@example.com', 'partner@example.com'])
    expect(() => addMemberEmail(added, 'Owner@Example.com', 'partner@example.com')).toThrow(/already-member/)
    expect(() => removeMemberEmail(added, 'Owner@Example.com', 'owner@example.com')).toThrow(/cannot-remove-owner/)
    expect(removeMemberEmail(added, 'Owner@Example.com', 'Partner@Example.com')).toEqual(['Owner@Example.com'])
    expect(displayMembers(added, 'Owner@Example.com').map((member) => member.role)).toEqual(['owner', 'member'])
  })
})

describe('chooseWedding', () => {
  it('prefers the shared wedding over an empty solo wedding until the user chooses', () => {
    const solo = wedding({ id: 'solo', ownerEmail: 'partner@example.com', memberEmails: ['partner@example.com'] })
    const shared = wedding({
      id: 'shared',
      ownerEmail: 'owner@example.com',
      memberEmails: ['owner@example.com', 'partner@example.com'],
    })
    expect(chooseWedding([solo, shared], null, 'partner@example.com')?.id).toBe('shared')
    expect(chooseWedding([solo, shared], 'solo', 'partner@example.com')?.id).toBe('solo')
    expect(chooseWedding([solo], null, 'partner@example.com')?.id).toBe('solo')
    expect(chooseWedding([], null, 'partner@example.com')).toBeNull()
  })
})

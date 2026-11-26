import type { Guest, GuestDraft } from './types.ts'

export function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'guest-1',
    fullName: 'דנה כהן',
    phone: '',
    side: null,
    subSide: 'none',
    category: 'other',
    categoryId: '',
    role: null,
    group: '',
    partySize: 1,
    childCount: 0,
    drinkerCount: 0,
    partySizeAssumed: false,
    rsvp: 'pending',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeDraft(overrides: Partial<GuestDraft> = {}): GuestDraft {
  const guest = makeGuest(overrides)
  return {
    fullName: guest.fullName,
    phone: guest.phone,
    side: guest.side,
    subSide: guest.subSide,
    category: guest.category,
    categoryId: guest.categoryId,
    role: guest.role,
    group: guest.group,
    partySize: guest.partySize,
    childCount: guest.childCount,
    drinkerCount: guest.drinkerCount,
    partySizeAssumed: guest.partySizeAssumed,
    rsvp: guest.rsvp,
    notes: guest.notes,
  }
}

import { describe, expect, it } from 'vitest'
import { parseStoredGuest } from './validation.ts'

const base = { id: 'g1', fullName: 'דנה כהן', partySize: 2, rsvp: 'pending', side: 'bride' }

describe('parseStoredGuest children', () => {
  it('reads the two age groups', () => {
    const guest = parseStoredGuest({ ...base, childrenSmall: 1, childrenOlder: 2 })
    expect([guest?.childrenSmall, guest?.childrenOlder]).toEqual([1, 2])
  })

  it('moves an old single children total into the older group', () => {
    const guest = parseStoredGuest({ ...base, childCount: 3 })
    expect([guest?.childrenSmall, guest?.childrenOlder]).toEqual([0, 3])
  })
})

describe('certain count', () => {
  it('keeps a stored certain count within the party size', () => {
    expect(parseStoredGuest({ ...base, certainCount: 1 })?.certainCount).toBe(1)
    expect(parseStoredGuest({ ...base, certainCount: 5 })?.certainCount).toBe(2)
    expect(parseStoredGuest(base)?.certainCount).toBe(0)
  })
})

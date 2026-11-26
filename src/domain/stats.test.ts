import { describe, expect, it } from 'vitest'
import { makeGuest } from './makeGuest.ts'
import { sideSlices, summarizeGuests } from './stats.ts'

describe('summarizeGuests', () => {
  it('sums people, not rows, and splits the totals by side', () => {
    const stats = summarizeGuests([
      makeGuest({ id: '1', side: 'groom', rsvp: 'attending', partySize: 3 }),
      makeGuest({ id: '2', side: 'groom', rsvp: 'declined', partySize: 2 }),
      makeGuest({ id: '3', side: 'bride', rsvp: 'pending', partySize: 4 }),
      makeGuest({ id: '4', side: null, rsvp: 'maybe', partySize: 1, partySizeAssumed: true }),
    ])

    expect(stats.overall).toMatchObject({
      records: 4,
      people: 10,
      attending: 3,
      declined: 2,
      pending: 4,
      maybe: 1,
      assumedRecords: 1,
    })
    expect(stats.bySide.groom.people).toBe(5)
    expect(stats.bySide.groom.attending).toBe(3)
    expect(stats.bySide.bride.pending).toBe(4)
    expect(stats.bySide.shared.people).toBe(0)
    expect(stats.bySide.unspecified.maybe).toBe(1)
    expect(stats.bySide.unspecified.assumedRecords).toBe(1)
  })

  it('groups people on each side for the visual split', () => {
    const slices = sideSlices([
      makeGuest({ side: 'groom', partySize: 2, category: 'family', group: 'משפחה גרעינית' }),
      makeGuest({ side: 'groom', partySize: 4, category: 'friends', group: 'חברים' }),
      makeGuest({ side: 'bride', partySize: 3, category: 'family', group: 'משפחה' }),
    ])
    expect(slices[0]).toEqual({
      side: 'groom',
      people: 6,
      groups: [
        { label: 'משפחה גרעינית', people: 2 },
        { label: 'חברים', people: 4 },
      ],
    })
    expect(slices[1].people).toBe(3)
  })
})

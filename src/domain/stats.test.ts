import { describe, expect, it } from 'vitest'
import { makeGuest } from './makeGuest.ts'
import { pieSlices, sideSlices, summarizeGuests } from './stats.ts'

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

  it('keeps children beside the adult total', () => {
    const stats = summarizeGuests([
      makeGuest({ partySize: 4, childCount: 2, rsvp: 'attending' }),
      makeGuest({ partySize: 1, childCount: 0, rsvp: 'declined' }),
    ])
    expect(stats.overall.people).toBe(5)
    expect(stats.overall.children).toBe(2)
    expect(stats.overall.attending).toBe(4)
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

  it('gives one side similar pie colors and the other side a different family', () => {
    const slices = pieSlices([
      makeGuest({ side: 'groom', partySize: 2, category: 'family', group: 'משפחה' }),
      makeGuest({ side: 'groom', partySize: 1, category: 'family', group: 'משפחה גרעינית' }),
      makeGuest({ side: 'bride', partySize: 3, category: 'friends', group: 'חברים' }),
    ])
    expect(slices.map((slice) => slice.label)).toEqual(['משפחה גרעינית', 'משפחה', 'חברים'])
    expect(slices[0].color.startsWith('hsl(152')).toBe(true)
    expect(slices[1].color.startsWith('hsl(152')).toBe(true)
    expect(slices[0].color).not.toBe(slices[1].color)
    expect(slices[2].color.startsWith('hsl(12')).toBe(true)
  })
})

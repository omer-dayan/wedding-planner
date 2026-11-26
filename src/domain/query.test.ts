import { describe, expect, it } from 'vitest'
import { makeGuest } from './makeGuest.ts'
import { categoryHeadcount, EMPTY_QUERY, queryGuests } from './query.ts'

const guests = [
  makeGuest({ id: '1', fullName: 'יוסי לוי', phone: '050-111', side: 'groom', group: 'עבודה', rsvp: 'attending' }),
  makeGuest({ id: '2', fullName: 'דנה כהן', phone: '052-222', side: 'bride', group: 'חברים / חברים צבא', rsvp: 'pending', notes: 'טבעונית' }),
  makeGuest({ id: '3', fullName: 'אבי ברק', side: null, group: 'משפחה', rsvp: 'declined' }),
]

describe('queryGuests', () => {
  it('filters by side, group and rsvp, and searches phone digits', () => {
    expect(queryGuests(guests, { search: '', side: 'bride', subSide: 'all', category: 'all', rsvp: 'all', sort: 'asc' }).map((guest) => guest.id)).toEqual(['2'])
    expect(queryGuests(guests, { search: '', side: 'unspecified', subSide: 'all', category: 'all', rsvp: 'all', sort: 'asc' }).map((guest) => guest.id)).toEqual(['3'])
    expect(queryGuests(guests, { search: '', side: 'all', subSide: 'all', category: 'all', rsvp: 'attending', sort: 'asc' }).map((guest) => guest.id)).toEqual(['1'])
    expect(queryGuests(guests, { search: '052222', side: 'all', subSide: 'all', category: 'all', rsvp: 'all', sort: 'asc' }).map((guest) => guest.id)).toEqual(['2'])
    expect(queryGuests(guests, { search: 'טבעונית', side: 'all', subSide: 'all', category: 'all', rsvp: 'all', sort: 'asc' }).map((guest) => guest.id)).toEqual(['2'])
  })

  it('counts a category for the active side and hides an empty branch as zero', () => {
    const categories = [
      { id: 'c_family', label: 'משפחה', parentId: '' },
      { id: 'c_iluz', label: 'משפחת אילוז', parentId: 'c_family' },
      { id: 'c_friends', label: 'חברים', parentId: '' },
    ]
    const rows = [
      makeGuest({ id: '1', side: 'groom', categoryId: 'c_family', partySize: 4 }),
      makeGuest({ id: '2', side: 'bride', categoryId: 'c_family', partySize: 2 }),
      makeGuest({ id: '3', side: 'groom', categoryId: 'c_iluz', partySize: 3 }),
      makeGuest({ id: '4', side: 'bride', categoryId: 'c_friends', partySize: 5 }),
    ]
    const bride = { ...EMPTY_QUERY, side: 'bride' as const }
    expect(categoryHeadcount(rows, bride, categories, 'c_family')).toBe(2)
    expect(categoryHeadcount(rows, bride, categories, 'c_iluz')).toBe(0)
    expect(categoryHeadcount(rows, bride, categories, 'c_friends')).toBe(5)
    expect(categoryHeadcount(rows, EMPTY_QUERY, categories, 'c_family')).toBe(9)
  })

  it('sorts by Hebrew name', () => {
    const asc = queryGuests(guests, { search: '', side: 'all', subSide: 'all', category: 'all', rsvp: 'all', sort: 'asc' }).map((guest) => guest.fullName)
    const desc = queryGuests(guests, { search: '', side: 'all', subSide: 'all', category: 'all', rsvp: 'all', sort: 'desc' }).map((guest) => guest.fullName)
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, 'he')))
    expect(desc).toEqual([...asc].reverse())
  })
})

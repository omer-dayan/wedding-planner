import { describe, expect, it } from 'vitest'
import { makeGuest } from './makeGuest.ts'
import { queryGuests } from './query.ts'

const guests = [
  makeGuest({ id: '1', fullName: 'יוסי לוי', phone: '050-111', side: 'groom', group: 'עבודה', rsvp: 'attending' }),
  makeGuest({ id: '2', fullName: 'דנה כהן', phone: '052-222', side: 'bride', group: 'חברים / חברים צבא', rsvp: 'pending', notes: 'טבעונית' }),
  makeGuest({ id: '3', fullName: 'אבי ברק', side: null, group: 'משפחה', rsvp: 'declined' }),
]

describe('queryGuests', () => {
  it('filters by side, group and rsvp, and searches phone digits', () => {
    expect(queryGuests(guests, { search: '', side: 'bride', group: 'all', rsvp: 'all', sort: 'asc' }).map((guest) => guest.id)).toEqual(['2'])
    expect(queryGuests(guests, { search: '', side: 'unspecified', group: 'all', rsvp: 'all', sort: 'asc' }).map((guest) => guest.id)).toEqual(['3'])
    expect(queryGuests(guests, { search: '', side: 'all', group: 'עבודה', rsvp: 'attending', sort: 'asc' }).map((guest) => guest.id)).toEqual(['1'])
    expect(queryGuests(guests, { search: '052222', side: 'all', group: 'all', rsvp: 'all', sort: 'asc' }).map((guest) => guest.id)).toEqual(['2'])
    expect(queryGuests(guests, { search: 'טבעונית', side: 'all', group: 'all', rsvp: 'all', sort: 'asc' }).map((guest) => guest.id)).toEqual(['2'])
  })

  it('sorts by Hebrew name', () => {
    const asc = queryGuests(guests, { search: '', side: 'all', group: 'all', rsvp: 'all', sort: 'asc' }).map((guest) => guest.fullName)
    const desc = queryGuests(guests, { search: '', side: 'all', group: 'all', rsvp: 'all', sort: 'desc' }).map((guest) => guest.fullName)
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, 'he')))
    expect(desc).toEqual([...asc].reverse())
  })
})

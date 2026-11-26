import { describe, expect, it } from 'vitest'
import { canManageVenues, compareVenues, googleTikTokVideoSearchUrl, mapsSearchUrl, normalizeVenue, offerTitle, tiktokAppSearchUrl, tiktokVideoId, tiktokWebVideoSearchUrl, venueVideoQuery, type Venue } from './venues.ts'

describe('venues', () => {
  it('requires a name and reads a TikTok video id', () => {
    expect(() => normalizeVenue({
      name: ' ',
      city: '',
      phone: '',
      website: '',
      priceNotes: '',
      status: 'want',
      visitDate: '',
      notes: '',
      tiktokUrls: [],
      answers: {},
      offers: [],
      imageUrl: '',
    })).toThrow(/venue-name-required/)
    expect(tiktokVideoId('https://www.tiktok.com/@hall/video/1234567890')).toBe('1234567890')
    expect(tiktokVideoId('https://vm.tiktok.com/ZMabc/')).toBeNull()
    const query = venueVideoQuery('גן ורדים', 'תל אביב')
    expect(query).toBe('גן ורדים תל אביב אולם')
    expect(venueVideoQuery('אולם גן ורדים', 'חיפה')).toBe('אולם גן ורדים חיפה')
    expect(tiktokAppSearchUrl(query)).toBe(`tiktok://search?keyword=${encodeURIComponent(query)}`)
    expect(tiktokWebVideoSearchUrl(query)).toBe(`https://www.tiktok.com/search/video?q=${encodeURIComponent(query)}`)
    expect(googleTikTokVideoSearchUrl('גן ורדים', 'תל אביב')).toContain('site%3Atiktok.com')
    expect(mapsSearchUrl('גן ורדים', 'תל אביב')).toContain('query=')
  })

  it('sorts the chosen venue first, then by status and visit date', () => {
    const venue = (name: string, status: Venue['status'], visitDate = ''): Venue => ({
      id: name,
      name,
      city: '',
      phone: '',
      website: '',
      priceNotes: '',
      status,
      visitDate,
      notes: '',
      tiktokUrls: [],
      answers: {},
      offers: [],
      imageUrl: '',
      addedByEmail: '',
      createdAt: '',
      updatedAt: '',
    })
    const sorted = [
      venue('מאוחר', 'scheduled', '2026-12-20'),
      venue('נבחר', 'chosen'),
      venue('מוקדם', 'scheduled', '2026-12-01'),
      venue('פסול', 'rejected'),
    ].sort(compareVenues)
    expect(sorted.map((item) => item.name)).toEqual(['נבחר', 'מוקדם', 'מאוחר', 'פסול'])
  })

  it('lets only the couple and the owner manage venues', () => {
    const wedding = {
      ownerEmail: 'owner@example.com',
      memberRoles: { 'bride@example.com': 'bride' as const, 'moti@example.com': 'groom_brother' as const },
    }
    expect(canManageVenues(wedding, 'owner@example.com')).toBe(true)
    expect(canManageVenues(wedding, 'bride@example.com')).toBe(true)
    expect(canManageVenues(wedding, 'moti@example.com')).toBe(false)
    expect(canManageVenues(null, null)).toBe(true)
  })

  it('keeps an existing answer sheet as one offer and names a date', () => {
    const venue = normalizeVenue({
      name: 'האחוזה',
      city: '',
      phone: '',
      website: '',
      priceNotes: '',
      status: 'want',
      visitDate: '',
      notes: '',
      tiktokUrls: [],
      answers: { q_plate: '480' },
      offers: [],
      imageUrl: '',
    })
    expect(venue.offers).toEqual([{ id: 'o_current', month: 0, weekday: '', answers: { q_plate: '480' } }])
    expect(offerTitle({ month: 1, weekday: 'sunday' })).toBe('יום ראשון בינואר')
    expect(offerTitle({ month: 9, weekday: 'thursday' })).toBe('יום חמישי בספטמבר')
  })
})

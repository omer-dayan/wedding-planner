import { describe, expect, it } from 'vitest'
import { canManageVenues, mapsSearchUrl, normalizeVenue, tiktokSearchUrl, tiktokVideoId } from './venues.ts'

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
    })).toThrow(/venue-name-required/)
    expect(tiktokVideoId('https://www.tiktok.com/@hall/video/1234567890')).toBe('1234567890')
    expect(tiktokVideoId('https://vm.tiktok.com/ZMabc/')).toBeNull()
    expect(tiktokSearchUrl('גן ורדים', 'תל אביב')).toContain(encodeURIComponent('גן ורדים תל אביב אולם'))
    expect(mapsSearchUrl('גן ורדים', 'תל אביב')).toContain('query=')
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
})

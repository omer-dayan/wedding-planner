import { describe, expect, it } from 'vitest'
import { canEditSong, normalizeSong, normalizeSongUrl } from './songs.ts'

describe('songs', () => {
  it('requires a title and accepts only http(s) links', () => {
    expect(normalizeSongUrl('')).toBe('')
    expect(normalizeSongUrl('https://open.spotify.com/track/abc')).toBe('https://open.spotify.com/track/abc')
    expect(() => normalizeSongUrl('spotify:track:abc')).toThrow(/invalid-url/)
    expect(() => normalizeSong({ title: '  ', artist: '', url: '', moment: null, notes: '' })).toThrow(/title-required/)
    expect(normalizeSong({ title: '  שיר  ', artist: 'אמן', url: 'http://youtu.be/x', moment: 'dancing', notes: '' })).toMatchObject({
      title: 'שיר',
      url: 'http://youtu.be/x',
      moment: 'dancing',
    })
  })

  it('lets the author, the couple, and the owner edit a song', () => {
    const wedding = {
      ownerEmail: 'owner@example.com',
      memberRoles: {
        'owner@example.com': 'groom',
        'bride@example.com': 'bride',
        'moti@example.com': 'groom_brother',
      },
    }
    const song = { addedByEmail: 'moti@example.com' }
    expect(canEditSong(wedding, 'moti@example.com', song)).toBe(true)
    expect(canEditSong(wedding, 'other@example.com', song)).toBe(false)
    expect(canEditSong(wedding, 'bride@example.com', song)).toBe(true)
    expect(canEditSong(wedding, 'owner@example.com', song)).toBe(true)
    expect(canEditSong(null, null, song)).toBe(true)
  })
})

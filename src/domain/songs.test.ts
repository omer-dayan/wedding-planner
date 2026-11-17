import { describe, expect, it } from 'vitest'
import { canEditSong, normalizeSong, normalizeSongUrl, sameSongTitleArtist, spotifyHref, spotifyTrackId } from './songs.ts'

describe('songs', () => {
  it('requires a title and accepts only http(s) links', () => {
    expect(normalizeSongUrl('')).toBe('')
    expect(normalizeSongUrl('https://open.spotify.com/track/abc')).toBe('https://open.spotify.com/track/abc')
    expect(() => normalizeSongUrl('spotify:track:abc')).toThrow(/invalid-url/)
    expect(() => normalizeSong({ title: '  ', artist: '', url: '', artworkUrl: '', previewUrl: '', moment: null, notes: '' })).toThrow(/title-required/)
    expect(normalizeSong({
      title: '  שיר  ',
      artist: 'אמן',
      url: 'http://youtu.be/x',
      artworkUrl: '',
      previewUrl: 'https://audio.example/preview.m4a',
      moment: 'dancing',
      notes: '',
    })).toMatchObject({
      title: 'שיר',
      url: 'http://youtu.be/x',
      previewUrl: 'https://audio.example/preview.m4a',
      moment: 'dancing',
    })
  })

  it('treats the same title and artist as one song', () => {
    expect(sameSongTitleArtist({ title: '  מלכת   הדור ', artist: 'Omer Adam' }, { title: 'מלכת הדור', artist: 'omer adam' })).toBe(true)
    expect(sameSongTitleArtist({ title: 'מלכת הדור', artist: 'Omer Adam' }, { title: 'מלכת הדור', artist: 'אחר' })).toBe(false)
  })

  it('uses a pasted Spotify track link and otherwise a search link', () => {
    expect(spotifyTrackId('https://open.spotify.com/track/abc123?si=xyz')).toBe('abc123')
    expect(spotifyHref('שיר', 'אמן', 'https://open.spotify.com/track/abc123')).toBe('https://open.spotify.com/track/abc123')
    expect(spotifyHref('שיר', 'אמן', '')).toBe(`https://open.spotify.com/search/${encodeURIComponent('שיר אמן')}`)
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

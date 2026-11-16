import { describe, expect, it } from 'vitest'
import { searchItunesSongs } from './itunes.ts'

describe('searchItunesSongs', () => {
  it('queries Israel first and adds US tracks only when Israel is thin', async () => {
    const calls: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      calls.push(url)
      const country = new URL(url).searchParams.get('country')
      const results = country === 'IL'
        ? [{ trackId: 1, trackName: 'מלכת הדור', artistName: 'Omer Adam', collectionName: 'אלבום', artworkUrl100: 'https://example/a.jpg', previewUrl: 'https://example/a.m4a' }]
        : [{ trackId: 2, trackName: 'Hello', artistName: 'Adele', collectionName: '25', artworkUrl100: 'https://example/b.jpg', previewUrl: 'https://example/b.m4a' }]
      return new Response(JSON.stringify({ results }))
    }
    const songs = await searchItunesSongs('עומר', fetchImpl)
    expect(calls[0]).toContain('country=IL')
    expect(calls[1]).toContain('country=US')
    expect(songs.map((song) => song.trackId)).toEqual([1, 2])
    expect(await searchItunesSongs('א', fetchImpl)).toEqual([])
  })
})

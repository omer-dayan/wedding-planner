export interface ItunesSong {
  trackId: number
  trackName: string
  artistName: string
  collectionName: string
  artworkUrl100: string
  previewUrl: string
}

export async function searchItunesSongs(term: string, fetchImpl: typeof fetch = fetch): Promise<ItunesSong[]> {
  const query = term.trim()
  if (query.length < 2) return []
  const israel = await searchCountry(query, 'IL', fetchImpl)
  if (israel.length >= 5) return israel.slice(0, 10)
  const unitedStates = await searchCountry(query, 'US', fetchImpl)
  const seen = new Set(israel.map((song) => song.trackId))
  return [...israel, ...unitedStates.filter((song) => !seen.has(song.trackId))].slice(0, 10)
}

async function searchCountry(term: string, country: 'IL' | 'US', fetchImpl: typeof fetch): Promise<ItunesSong[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=10&country=${country}`
  const response = await fetchImpl(url)
  if (!response.ok) return []
  const payload = (await response.json()) as { results?: unknown[] }
  return (payload.results ?? []).flatMap(toSong)
}

function toSong(value: unknown): ItunesSong[] {
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  if (typeof record.trackId !== 'number' || typeof record.trackName !== 'string' || typeof record.artistName !== 'string') {
    return []
  }
  return [{
    trackId: record.trackId,
    trackName: record.trackName,
    artistName: record.artistName,
    collectionName: typeof record.collectionName === 'string' ? record.collectionName : '',
    artworkUrl100: typeof record.artworkUrl100 === 'string' ? record.artworkUrl100 : '',
    previewUrl: typeof record.previewUrl === 'string' ? record.previewUrl : '',
  }]
}

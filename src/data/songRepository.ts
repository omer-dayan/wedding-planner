import { DomainError } from '../domain/errors.ts'
import type { Song, SongDraft } from '../domain/songs.ts'
import { normalizeSong, parseStoredSong } from '../domain/songs.ts'
import type { WeddingRoleId } from '../domain/roles.ts'
import type { KeyValueStorage } from './storage.ts'

export const SONG_STORAGE_KEY = 'wedding-planner.songs.v1'

export interface SongAuthor {
  email: string
  name: string
  role: WeddingRoleId | null
}

export interface SongRepository {
  subscribe(listener: (songs: Song[]) => void, onError?: (error: unknown) => void): () => void
  create(draft: SongDraft, author: SongAuthor): Promise<Song>
  update(id: string, draft: SongDraft): Promise<Song>
  remove(id: string): Promise<void>
}

export function createLocalSongRepository(storage: KeyValueStorage, key = SONG_STORAGE_KEY): SongRepository {
  const listeners = new Set<(songs: Song[]) => void>()
  let songs = readSongs(storage, key)

  function persist(next: Song[]) {
    try {
      storage.setItem(key, JSON.stringify(next))
    } catch {
      throw new DomainError('storage-full')
    }
    songs = next
    for (const listener of listeners) listener(songs)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== key) return
      songs = readSongs(storage, key)
      for (const listener of listeners) listener(songs)
    })
  }

  return {
    subscribe(listener) {
      listener(songs)
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async create(draft, author) {
      const normalized = normalizeSong(draft)
      const timestamp = new Date().toISOString()
      const song: Song = {
        id: crypto.randomUUID(),
        ...normalized,
        addedByEmail: author.email.trim().toLowerCase(),
        addedByName: author.name.trim() || 'מכשיר זה',
        addedByRole: author.role,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      persist([...songs, song])
      return song
    },
    async update(id, draft) {
      const normalized = normalizeSong(draft)
      const current = songs.find((song) => song.id === id)
      if (!current) throw new DomainError('not-found')
      const song: Song = { ...current, ...normalized, updatedAt: new Date().toISOString() }
      persist(songs.map((item) => (item.id === id ? song : item)))
      return song
    },
    async remove(id) {
      if (!songs.some((song) => song.id === id)) throw new DomainError('not-found')
      persist(songs.filter((song) => song.id !== id))
    },
  }
}

function readSongs(storage: KeyValueStorage, key: string): Song[] {
  const raw = storage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      const song = parseStoredSong(entry)
      return song ? [song] : []
    })
  } catch {
    return []
  }
}

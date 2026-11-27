import { songAddedInput, songDeletedInput } from '../domain/activity.ts'
import { normalizeSong, parseStoredSong, type Song, type SongDraft } from '../domain/songs.ts'
import type { WeddingRoleId } from '../domain/roles.ts'
import type { ActivityLogger } from './activityLog.ts'
import { createRecordRepository, localStore, type RecordRepository, type RecordSpec } from './records.ts'
import type { KeyValueStorage } from './storage.ts'

export const SONG_STORAGE_KEY = 'wedding-planner.songs.v1'

export interface Author {
  email: string
  name: string
  role: WeddingRoleId | null
}

export type SongRepository = RecordRepository<Song, SongDraft, Author>

export const songSpec: RecordSpec<Song, SongDraft, Author> = {
  normalize: normalizeSong,
  author: (author) => ({
    addedByEmail: author.email.trim().toLowerCase(),
    addedByName: author.name.trim() || author.email || 'מכשיר זה',
    addedByRole: author.role,
  }),
  created: (song) => [songAddedInput(song)],
  removed: (song) => [songDeletedInput(song)],
}

export function createLocalSongRepository(storage: KeyValueStorage, key = SONG_STORAGE_KEY, logger?: ActivityLogger): SongRepository {
  return createRecordRepository(localStore(storage, key, parseStoredSong, logger), songSpec)
}

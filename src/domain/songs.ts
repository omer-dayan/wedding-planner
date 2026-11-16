import { ValidationError } from './errors.ts'
import type { WeddingRoleId } from './roles.ts'
import { isWeddingRole } from './roles.ts'
import type { RoleAssignment } from './roles.ts'
import { isCoupleOrOwner } from './roles.ts'

export const SONG_MOMENTS = [
  { id: 'reception', label: 'קבלת פנים' },
  { id: 'chuppah', label: 'חופה' },
  { id: 'chuppah_entrance', label: 'כניסה לחופה' },
  { id: 'glass', label: 'שבירת כוס' },
  { id: 'dancing', label: 'ריקודים' },
  { id: 'other', label: 'אחר' },
] as const

export type SongMomentId = (typeof SONG_MOMENTS)[number]['id']

export interface SongDraft {
  title: string
  artist: string
  url: string
  moment: SongMomentId | null
  notes: string
}

export interface Song extends SongDraft {
  id: string
  addedByEmail: string
  addedByName: string
  addedByRole: WeddingRoleId | null
  createdAt: string
  updatedAt: string
}

export function isSongMoment(value: unknown): value is SongMomentId {
  return typeof value === 'string' && SONG_MOMENTS.some((moment) => moment.id === value)
}

export function momentLabel(moment: SongMomentId | null): string {
  if (!moment) return 'ללא רגע'
  return SONG_MOMENTS.find((item) => item.id === moment)?.label ?? 'ללא רגע'
}

export function normalizeSong(input: SongDraft): SongDraft {
  const title = input.title.trim().replace(/\s+/g, ' ')
  const artist = input.artist.trim().replace(/\s+/g, ' ')
  const notes = input.notes.trim()
  const errors: string[] = []
  if (!title) errors.push('title-required')
  if (title.length > 200) errors.push('title-length')
  if (artist.length > 200) errors.push('artist-length')
  if (notes.length > 2000) errors.push('notes-length')
  if (input.moment !== null && !isSongMoment(input.moment)) errors.push('moment')
  let url = ''
  try {
    url = normalizeSongUrl(input.url)
  } catch {
    errors.push('invalid-url')
  }
  if (errors.length > 0) throw new ValidationError(errors)
  return { title, artist, url, moment: input.moment, notes }
}

export function normalizeSongUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new ValidationError(['invalid-url'])
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ValidationError(['invalid-url'])
  return url.toString()
}

export function parseStoredSong(value: unknown): Song | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id) return null
  let draft: SongDraft
  try {
    draft = normalizeSong({
      title: typeof record.title === 'string' ? record.title : '',
      artist: typeof record.artist === 'string' ? record.artist : '',
      url: typeof record.url === 'string' ? record.url : '',
      moment: isSongMoment(record.moment) ? record.moment : null,
      notes: typeof record.notes === 'string' ? record.notes : '',
    })
  } catch {
    return null
  }
  return {
    id: record.id,
    ...draft,
    addedByEmail: typeof record.addedByEmail === 'string' ? record.addedByEmail.trim().toLowerCase() : '',
    addedByName: typeof record.addedByName === 'string' ? record.addedByName.trim() : '',
    addedByRole: isWeddingRole(record.addedByRole) ? record.addedByRole : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
  }
}

export function canEditSong(
  wedding: RoleAssignment | null,
  email: string | null,
  song: { addedByEmail: string },
): boolean {
  if (!email || !wedding) return true
  if (isCoupleOrOwner(wedding, email)) return true
  return song.addedByEmail.trim().toLowerCase() === email.trim().toLowerCase()
}

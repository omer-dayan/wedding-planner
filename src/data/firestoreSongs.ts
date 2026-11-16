import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import { DomainError } from '../domain/errors.ts'
import { normalizeSong, parseStoredSong, type Song } from '../domain/songs.ts'
import type { SongRepository } from './songRepository.ts'

export type { SongRepository }

export function createFirestoreSongRepository(db: Firestore, weddingId: string): SongRepository {
  const songs = collection(db, 'weddings', weddingId, 'songs')

  return {
    subscribe(listener, onError) {
      return onSnapshot(
        songs,
        (snapshot) => {
          listener(
            snapshot.docs.flatMap((entry) => {
              const song = parseStoredSong({ ...entry.data(), id: entry.id })
              return song ? [song] : []
            }),
          )
        },
        (error) => onError?.(error),
      )
    },
    async create(draft, author) {
      const normalized = normalizeSong(draft)
      const timestamp = new Date().toISOString()
      const song: Song = {
        id: crypto.randomUUID(),
        ...normalized,
        addedByEmail: author.email.trim().toLowerCase(),
        addedByName: author.name.trim() || author.email,
        addedByRole: author.role,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await setDoc(doc(songs, song.id), songToDoc(song))
      return song
    },
    async update(id, draft) {
      const normalized = normalizeSong(draft)
      const ref = doc(songs, id)
      const current = await getDoc(ref)
      if (!current.exists()) throw new DomainError('not-found')
      const stored = parseStoredSong({ ...current.data(), id })
      if (!stored) throw new DomainError('not-found')
      const song: Song = { ...stored, ...normalized, updatedAt: new Date().toISOString() }
      await updateDoc(ref, songToDoc(song))
      return song
    },
    async remove(id) {
      const ref = doc(songs, id)
      const current = await getDoc(ref)
      if (!current.exists()) throw new DomainError('not-found')
      await deleteDoc(ref)
    },
  }
}

function songToDoc(song: Song): Record<string, string | null> {
  return {
    title: song.title,
    artist: song.artist,
    url: song.url,
    moment: song.moment,
    notes: song.notes,
    addedByEmail: song.addedByEmail,
    addedByName: song.addedByName,
    addedByRole: song.addedByRole,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
  }
}

import { DomainError, ValidationError } from '../domain/errors.ts'
import { normalizeDraft, parseStoredGuest } from '../domain/validation.ts'
import type { Guest, GuestDraft } from '../domain/types.ts'
import type { KeyValueStorage } from './storage.ts'

export const GUEST_STORAGE_KEY = 'wedding-planner.guests.v1'

export interface GuestRepository {
  subscribe(listener: (guests: Guest[]) => void, onError?: (error: unknown) => void): () => void
  ready(): Promise<Guest[]>
  create(draft: GuestDraft): Promise<Guest>
  update(id: string, draft: GuestDraft): Promise<Guest>
  remove(id: string): Promise<void>
  replaceAll(guests: readonly Guest[]): Promise<void>
}

export function createLocalGuestRepository(
  storage: KeyValueStorage,
  key = GUEST_STORAGE_KEY,
): GuestRepository {
  const listeners = new Set<(guests: Guest[]) => void>()
  let guests = readGuests(storage, key)

  function persist(next: Guest[]) {
    try {
      storage.setItem(key, JSON.stringify(next))
    } catch {
      throw new DomainError('storage-full')
    }
    guests = next
    for (const listener of listeners) listener(guests)
  }

  function reload() {
    guests = readGuests(storage, key)
    for (const listener of listeners) listener(guests)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === key) reload()
    })
  }

  return {
    subscribe(listener) {
      listener(guests)
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    ready() {
      return Promise.resolve(guests)
    },
    async create(draft) {
      const normalized = normalizeDraft(draft)
      const timestamp = new Date().toISOString()
      const guest: Guest = {
        id: crypto.randomUUID(),
        ...normalized,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      persist([...guests, guest])
      return guest
    },
    async update(id, draft) {
      const normalized = normalizeDraft(draft)
      const current = guests.find((guest) => guest.id === id)
      if (!current) throw new DomainError('not-found')
      const guest: Guest = { ...current, ...normalized, updatedAt: new Date().toISOString() }
      persist(guests.map((item) => (item.id === id ? guest : item)))
      return guest
    },
    async remove(id) {
      if (!guests.some((guest) => guest.id === id)) throw new DomainError('not-found')
      persist(guests.filter((guest) => guest.id !== id))
    },
    async replaceAll(next) {
      const clean: Guest[] = []
      for (const guest of next) {
        const parsed = parseStoredGuest(guest)
        if (!parsed) throw new ValidationError(['invalid-guest'])
        clean.push(parsed)
      }
      persist(clean)
    },
  }
}

function readGuests(storage: KeyValueStorage, key: string): Guest[] {
  const raw = storage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      const guest = parseStoredGuest(entry)
      return guest ? [guest] : []
    })
  } catch {
    return []
  }
}

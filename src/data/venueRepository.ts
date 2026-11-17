import { venueActivity } from '../domain/activity.ts'
import { DomainError } from '../domain/errors.ts'
import { normalizeVenue, parseStoredVenue, type Venue, type VenueDraft } from '../domain/venues.ts'
import { recordActivity, type ActivityLogger } from './activityLog.ts'
import type { KeyValueStorage } from './storage.ts'

export const VENUE_STORAGE_KEY = 'wedding-planner.venues.v1'

export interface VenueRepository {
  subscribe(listener: (venues: Venue[]) => void, onError?: (error: unknown) => void): () => void
  create(draft: VenueDraft, addedByEmail: string): Promise<Venue>
  update(id: string, draft: VenueDraft): Promise<Venue>
  remove(id: string): Promise<void>
}

export function createLocalVenueRepository(storage: KeyValueStorage, key = VENUE_STORAGE_KEY, logger?: ActivityLogger): VenueRepository {
  const listeners = new Set<(venues: Venue[]) => void>()
  let venues = readVenues(storage, key)

  function persist(next: Venue[]) {
    try {
      storage.setItem(key, JSON.stringify(next))
    } catch {
      throw new DomainError('storage-full')
    }
    venues = next
    for (const listener of listeners) listener(venues)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== key) return
      venues = readVenues(storage, key)
      for (const listener of listeners) listener(venues)
    })
  }

  return {
    subscribe(listener) {
      listener(venues)
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async create(draft, addedByEmail) {
      const normalized = normalizeVenue(draft)
      const timestamp = new Date().toISOString()
      const venue: Venue = {
        id: crypto.randomUUID(),
        ...normalized,
        addedByEmail: addedByEmail.trim().toLowerCase(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      persist([...venues, venue])
      recordActivity(logger, venueActivity(null, venue))
      return venue
    },
    async update(id, draft) {
      const normalized = normalizeVenue(draft)
      const current = venues.find((venue) => venue.id === id)
      if (!current) throw new DomainError('not-found')
      const venue: Venue = { ...current, ...normalized, updatedAt: new Date().toISOString() }
      persist(venues.map((item) => (item.id === id ? venue : item)))
      recordActivity(logger, venueActivity(current, venue))
      return venue
    },
    async remove(id) {
      if (!venues.some((venue) => venue.id === id)) throw new DomainError('not-found')
      persist(venues.filter((venue) => venue.id !== id))
    },
  }
}

function readVenues(storage: KeyValueStorage, key: string): Venue[] {
  const raw = storage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      const venue = parseStoredVenue(entry)
      return venue ? [venue] : []
    })
  } catch {
    return []
  }
}

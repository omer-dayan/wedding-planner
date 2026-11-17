import { collection, doc, getDoc, onSnapshot, writeBatch, type Firestore } from 'firebase/firestore'
import { venueActivity } from '../domain/activity.ts'
import { DomainError } from '../domain/errors.ts'
import { normalizeVenue, parseStoredVenue, type Venue } from '../domain/venues.ts'
import { recordActivity, type ActivityLogger } from './activityLog.ts'
import type { VenueRepository } from './venueRepository.ts'

export function createFirestoreVenueRepository(db: Firestore, weddingId: string, logger?: ActivityLogger): VenueRepository {
  const venues = collection(db, 'weddings', weddingId, 'venues')

  return {
    subscribe(listener, onError) {
      return onSnapshot(
        venues,
        (snapshot) => {
          listener(
            snapshot.docs.flatMap((entry) => {
              const venue = parseStoredVenue({ ...entry.data(), id: entry.id })
              return venue ? [venue] : []
            }),
          )
        },
        (error) => onError?.(error),
      )
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
      const batch = writeBatch(db)
      batch.set(doc(venues, venue.id), venueToDoc(venue))
      recordActivity(logger, venueActivity(null, venue), batch)
      await batch.commit()
      return venue
    },
    async update(id, draft) {
      const normalized = normalizeVenue(draft)
      const ref = doc(venues, id)
      const current = await getDoc(ref)
      if (!current.exists()) throw new DomainError('not-found')
      const stored = parseStoredVenue({ ...current.data(), id })
      if (!stored) throw new DomainError('not-found')
      const venue: Venue = { ...stored, ...normalized, updatedAt: new Date().toISOString() }
      const batch = writeBatch(db)
      batch.update(ref, venueToDoc(venue))
      recordActivity(logger, venueActivity(stored, venue), batch)
      await batch.commit()
      return venue
    },
    async remove(id) {
      const ref = doc(venues, id)
      const current = await getDoc(ref)
      if (!current.exists()) throw new DomainError('not-found')
      const batch = writeBatch(db)
      batch.delete(ref)
      await batch.commit()
    },
  }
}

function venueToDoc(venue: Venue): Record<string, string | string[]> {
  return {
    name: venue.name,
    city: venue.city,
    phone: venue.phone,
    website: venue.website,
    priceNotes: venue.priceNotes,
    status: venue.status,
    visitDate: venue.visitDate,
    notes: venue.notes,
    tiktokUrls: venue.tiktokUrls,
    addedByEmail: venue.addedByEmail,
    createdAt: venue.createdAt,
    updatedAt: venue.updatedAt,
  }
}

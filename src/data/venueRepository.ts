import { venueActivity } from '../domain/activity.ts'
import { normalizeVenue, parseStoredVenue, type Venue, type VenueDraft } from '../domain/venues.ts'
import type { ActivityLogger } from './activityLog.ts'
import { createRecordRepository, localStore, type RecordRepository, type RecordSpec } from './records.ts'
import type { KeyValueStorage } from './storage.ts'

export const VENUE_STORAGE_KEY = 'wedding-planner.venues.v1'

export type VenueRepository = RecordRepository<Venue, VenueDraft, string>

export const venueSpec: RecordSpec<Venue, VenueDraft, string> = {
  normalize: normalizeVenue,
  author: (email) => ({ addedByEmail: email.trim().toLowerCase() }),
  created: (venue) => venueActivity(null, venue),
  updated: (before, after) => venueActivity(before, after),
}

export function createLocalVenueRepository(storage: KeyValueStorage, key = VENUE_STORAGE_KEY, logger?: ActivityLogger): VenueRepository {
  return createRecordRepository(localStore(storage, key, parseStoredVenue, logger), venueSpec)
}

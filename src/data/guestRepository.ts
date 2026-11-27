import { guestActivity, importActivity } from '../domain/activity.ts'
import { normalizeDraft, parseStoredGuest } from '../domain/validation.ts'
import type { Guest, GuestDraft } from '../domain/types.ts'
import type { ActivityLogger } from './activityLog.ts'
import { createRecordRepository, localStore, type RecordRepository, type RecordSpec } from './records.ts'
import type { KeyValueStorage } from './storage.ts'

export const GUEST_STORAGE_KEY = 'wedding-planner.guests.v1'

export type GuestRepository = RecordRepository<Guest, GuestDraft>

export const guestSpec: RecordSpec<Guest, GuestDraft, void> = {
  normalize: normalizeDraft,
  author: () => ({}),
  created: (guest) => guestActivity(null, guest),
  updated: (before, after) => guestActivity(before, after),
  removed: (guest) => guestActivity(guest, null),
  createdMany: (guests) => [importActivity(guests)],
}

export function createLocalGuestRepository(storage: KeyValueStorage, key = GUEST_STORAGE_KEY, logger?: ActivityLogger): GuestRepository {
  return createRecordRepository(localStore(storage, key, parseStoredGuest, logger), guestSpec)
}

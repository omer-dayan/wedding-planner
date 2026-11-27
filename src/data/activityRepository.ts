import { emptyDetails, parseActivityEvent, type ActivityActor, type ActivityEvent } from '../domain/activity.ts'
import { ACTIVITY_PAGE_SIZE, ACTIVITY_STORAGE_KEY, type ActivityPage, type ActivityRepository } from './activityLog.ts'
import { createLocalList } from './records.ts'
import type { KeyValueStorage } from './storage.ts'

export function createLocalActivityRepository(
  storage: KeyValueStorage,
  actor: () => ActivityActor,
  key = ACTIVITY_STORAGE_KEY,
): ActivityRepository {
  const list = createLocalList(storage, key, parseActivityEvent)
  const listeners = new Set<(page: ActivityPage) => void>()
  let shown = ACTIVITY_PAGE_SIZE

  function page(events: ActivityEvent[]): ActivityPage {
    const ordered = events.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { events: ordered.slice(0, shown), hasMore: ordered.length > shown }
  }

  list.subscribe((events) => {
    for (const listener of listeners) listener(page(events))
  })

  return {
    actor,
    append(input) {
      const current = actor()
      list.save([{
        id: crypto.randomUUID(),
        type: input.type,
        entity: input.entity,
        entityId: input.entityId,
        entityName: input.entityName,
        actorEmail: current.email.trim().toLowerCase(),
        actorName: current.name.trim() || 'מכשיר זה',
        actorRole: current.role,
        actorPhotoUrl: current.photoUrl.trim(),
        createdAt: new Date().toISOString(),
        details: emptyDetails(input.details),
      }, ...list.items()])
    },
    subscribe(listener) {
      listener(page(list.items()))
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async loadMore() {
      shown += ACTIVITY_PAGE_SIZE
      for (const listener of listeners) listener(page(list.items()))
    },
  }
}

import { emptyDetails, isActivityType, type ActivityActor, type ActivityEvent, type ActivityInput } from '../domain/activity.ts'
import { isWeddingRole } from '../domain/roles.ts'
import { DomainError } from '../domain/errors.ts'
import type { KeyValueStorage } from './storage.ts'
import { ACTIVITY_PAGE_SIZE, ACTIVITY_STORAGE_KEY, type ActivityPage, type ActivityRepository } from './activityLog.ts'

export function createLocalActivityRepository(
  storage: KeyValueStorage,
  actor: () => ActivityActor,
  key = ACTIVITY_STORAGE_KEY,
): ActivityRepository {
  const listeners = new Set<(page: ActivityPage) => void>()
  let events = readEvents(storage, key)
  let shown = ACTIVITY_PAGE_SIZE

  function persist(next: ActivityEvent[]) {
    try {
      storage.setItem(key, JSON.stringify(next))
    } catch {
      throw new DomainError('storage-full')
    }
    events = next
    publish()
  }

  function publish() {
    const ordered = events.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const page = { events: ordered.slice(0, shown), hasMore: ordered.length > shown }
    for (const listener of listeners) listener(page)
  }

  return {
    actor,
    append(input: ActivityInput) {
      const current = actor()
      const event: ActivityEvent = {
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
      }
      persist([event, ...events])
    },
    subscribe(listener) {
      listener({ events: events.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, shown), hasMore: events.length > shown })
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async loadMore() {
      shown += ACTIVITY_PAGE_SIZE
      publish()
    },
  }
}

function readEvents(storage: KeyValueStorage, key: string): ActivityEvent[] {
  const raw = storage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => parseEvent(entry))
  } catch {
    return []
  }
}

function parseEvent(value: unknown): ActivityEvent[] {
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !isActivityType(record.type)) return []
  if (record.entity !== 'guest' && record.entity !== 'song' && record.entity !== 'venue' && record.entity !== 'member' && record.entity !== 'rsvp') {
    return []
  }
  const details = record.details && typeof record.details === 'object' ? record.details as Record<string, unknown> : {}
  return [{
    id: record.id,
    type: record.type,
    entity: record.entity,
    entityId: typeof record.entityId === 'string' ? record.entityId : '',
    entityName: typeof record.entityName === 'string' ? record.entityName : '',
    actorEmail: typeof record.actorEmail === 'string' ? record.actorEmail : '',
    actorName: typeof record.actorName === 'string' ? record.actorName : '',
    actorRole: isWeddingRole(record.actorRole) ? record.actorRole : null,
    actorPhotoUrl: typeof record.actorPhotoUrl === 'string' ? record.actorPhotoUrl : '',
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    details: emptyDetails({
      from: typeof details.from === 'string' ? details.from : '',
      to: typeof details.to === 'string' ? details.to : '',
      count: typeof details.count === 'number' ? details.count : 0,
      names: Array.isArray(details.names) ? details.names.filter((name): name is string => typeof name === 'string').slice(0, 8) : [],
      fields: Array.isArray(details.fields) ? details.fields.filter((field): field is string => typeof field === 'string').slice(0, 12) : [],
      artworkUrl: typeof details.artworkUrl === 'string' ? details.artworkUrl : '',
    }),
  }]
}

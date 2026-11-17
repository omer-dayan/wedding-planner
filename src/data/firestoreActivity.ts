import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore'
import { emptyDetails, isActivityType, type ActivityActor, type ActivityEvent, type ActivityInput } from '../domain/activity.ts'
import { isWeddingRole } from '../domain/roles.ts'
import { ACTIVITY_PAGE_SIZE, type ActivityRepository } from './activityLog.ts'

export function createFirestoreActivityRepository(
  db: Firestore,
  weddingId: string,
  actor: () => ActivityActor,
): ActivityRepository {
  const activity = collection(db, 'weddings', weddingId, 'activity')
  const listeners = new Set<(page: { events: ActivityEvent[]; hasMore: boolean }) => void>()
  let shown = ACTIVITY_PAGE_SIZE
  let latest: { events: ActivityEvent[]; hasMore: boolean } = { events: [], hasMore: false }
  let stop = () => {}
  let listening = false

  function publish(events: ActivityEvent[], hasMore: boolean) {
    latest = { events, hasMore }
    for (const listener of listeners) listener(latest)
  }

  function restart(onError?: (error: unknown) => void) {
    stop()
    listening = true
    const page = query(activity, orderBy('createdAt', 'desc'), limit(shown))
    stop = onSnapshot(
      page,
      (snapshot) => publish(snapshot.docs.flatMap((entry) => parseActivity(entry.id, entry.data())), snapshot.size >= shown),
      (error) => onError?.(error),
    )
  }

  function stage(batch: WriteBatch, input: ActivityInput) {
    batch.set(doc(activity), activityFields(actor(), input))
  }

  return {
    actor,
    append(input) {
      const batch = writeBatch(db)
      stage(batch, input)
      void batch.commit()
    },
    stage,
    subscribe(listener, onError) {
      listeners.add(listener)
      listener(latest)
      if (!listening) restart(onError)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          stop()
          listening = false
        }
      }
    },
    async loadMore() {
      shown += ACTIVITY_PAGE_SIZE
      if (listening) restart()
    },
  }
}

export function activityFields(actor: ActivityActor, input: ActivityInput) {
  return {
    type: input.type,
    entity: input.entity,
    entityId: input.entityId,
    entityName: input.entityName.slice(0, 280),
    actorEmail: actor.email.trim().toLowerCase(),
    actorName: (actor.name.trim() || actor.email).slice(0, 180),
    actorRole: actor.role,
    actorPhotoUrl: actor.photoUrl.trim().slice(0, 900),
    createdAt: serverTimestamp(),
    details: emptyDetails(input.details),
  }
}

function parseActivity(id: string, data: Record<string, unknown>): ActivityEvent[] {
  if (!isActivityType(data.type)) return []
  if (data.entity !== 'guest' && data.entity !== 'song' && data.entity !== 'venue' && data.entity !== 'member' && data.entity !== 'rsvp') {
    return []
  }
  const details = data.details && typeof data.details === 'object' ? data.details as Record<string, unknown> : {}
  return [{
    id,
    type: data.type,
    entity: data.entity,
    entityId: typeof data.entityId === 'string' ? data.entityId : '',
    entityName: typeof data.entityName === 'string' ? data.entityName : '',
    actorEmail: typeof data.actorEmail === 'string' ? data.actorEmail : '',
    actorName: typeof data.actorName === 'string' ? data.actorName : '',
    actorRole: isWeddingRole(data.actorRole) ? data.actorRole : null,
    actorPhotoUrl: typeof data.actorPhotoUrl === 'string' ? data.actorPhotoUrl : '',
    createdAt: timestampToIso(data.createdAt),
    details: emptyDetails({
      from: typeof details.from === 'string' ? details.from : '',
      to: typeof details.to === 'string' ? details.to : '',
      count: typeof details.count === 'number' ? details.count : 0,
      names: stringList(details.names),
      fields: stringList(details.fields),
      artworkUrl: typeof details.artworkUrl === 'string' ? details.artworkUrl : '',
    }),
  }]
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : []
}

function timestampToIso(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

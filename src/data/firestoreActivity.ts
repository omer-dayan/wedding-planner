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
import { emptyDetails, parseActivityEvent, type ActivityActor, type ActivityEvent, type ActivityInput } from '../domain/activity.ts'
import { timestampToIso } from './firestoreListeners.ts'
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
      (snapshot) => publish(snapshot.docs.flatMap((entry) => parseActivityEvent({ ...entry.data(), id: entry.id, createdAt: timestampToIso(entry.data().createdAt) }) ?? []), snapshot.size >= shown),
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

function activityFields(actor: ActivityActor, input: ActivityInput) {
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

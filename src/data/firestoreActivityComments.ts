import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore'
import { buildComment, COMMENT_TEXT_MAX, type ActivityComment } from '../domain/activityComments.ts'
import type { ActivityActor } from '../domain/activity.ts'
import { isWeddingRole } from '../domain/roles.ts'
import type { ActivityCommentRepository } from './activityCommentRepository.ts'

export function createFirestoreActivityCommentRepository(
  db: Firestore,
  weddingId: string,
  actor: () => ActivityActor,
): ActivityCommentRepository {
  const comments = collection(db, 'weddings', weddingId, 'activityComments')
  const listeners = new Set<(comments: ActivityComment[]) => void>()
  let latest: ActivityComment[] = []
  let stop = () => {}
  let listening = false

  function publish(next: ActivityComment[]) {
    latest = next
    for (const listener of listeners) listener(latest)
  }

  function start(onError?: (error: unknown) => void) {
    stop()
    listening = true
    const page = query(comments, orderBy('createdAt', 'asc'))
    stop = onSnapshot(
      page,
      (snapshot) => publish(snapshot.docs.flatMap((entry) => parseComment(entry.id, entry.data()))),
      (error) => onError?.(error),
    )
  }

  return {
    subscribe(listener, onError) {
      listeners.add(listener)
      listener(latest)
      if (!listening) start(onError)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          stop()
          listening = false
        }
      }
    },
    async add(eventId, text) {
      const current = actor()
      const draft = buildComment(eventId, text, current)
      const ref = await addDoc(comments, {
        eventId: draft.eventId,
        text: draft.text,
        actorEmail: draft.actorEmail,
        actorName: draft.actorName,
        actorRole: draft.actorRole,
        actorPhotoUrl: draft.actorPhotoUrl,
        createdAt: serverTimestamp(),
      })
      return { ...draft, id: ref.id }
    },
    async remove(id) {
      await deleteDoc(doc(comments, id))
    },
  }
}

function parseComment(id: string, data: Record<string, unknown>): ActivityComment[] {
  if (typeof data.eventId !== 'string' || data.eventId.length === 0) return []
  if (typeof data.text !== 'string' || data.text.trim().length === 0 || data.text.length > COMMENT_TEXT_MAX) return []
  return [{
    id,
    eventId: data.eventId,
    text: data.text.trim(),
    actorEmail: typeof data.actorEmail === 'string' ? data.actorEmail : '',
    actorName: typeof data.actorName === 'string' ? data.actorName : '',
    actorRole: isWeddingRole(data.actorRole) ? data.actorRole : null,
    actorPhotoUrl: typeof data.actorPhotoUrl === 'string' ? data.actorPhotoUrl : '',
    createdAt: timestampToIso(data.createdAt),
  }]
}

function timestampToIso(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

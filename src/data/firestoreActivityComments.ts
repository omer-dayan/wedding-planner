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
import { buildComment, parseStoredComment, type ActivityComment } from '../domain/activityComments.ts'
import type { ActivityActor } from '../domain/activity.ts'
import { timestampToIso } from './firestoreListeners.ts'
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
      (snapshot) => publish(snapshot.docs.flatMap((entry) => parseStoredComment({ ...entry.data(), id: entry.id, createdAt: timestampToIso(entry.data().createdAt) }) ?? [])),
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

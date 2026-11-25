import { buildComment, parseStoredComment, type ActivityComment } from '../domain/activityComments.ts'
import type { ActivityActor } from '../domain/activity.ts'
import { DomainError } from '../domain/errors.ts'
import type { KeyValueStorage } from './storage.ts'

export const ACTIVITY_COMMENTS_STORAGE_KEY = 'wedding-planner.activityComments.v1'

export interface ActivityCommentRepository {
  subscribe(listener: (comments: ActivityComment[]) => void, onError?: (error: unknown) => void): () => void
  add(eventId: string, text: string): Promise<ActivityComment>
  remove(id: string): Promise<void>
}

export function createLocalActivityCommentRepository(
  storage: KeyValueStorage,
  actor: () => ActivityActor,
  key = ACTIVITY_COMMENTS_STORAGE_KEY,
): ActivityCommentRepository {
  const listeners = new Set<(comments: ActivityComment[]) => void>()
  let comments = readComments(storage, key)

  function persist(next: ActivityComment[]) {
    try {
      storage.setItem(key, JSON.stringify(next))
    } catch {
      throw new DomainError('storage-full')
    }
    comments = next
    publish()
  }

  function publish() {
    const ordered = comments.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (const listener of listeners) listener(ordered)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== key) return
      comments = readComments(storage, key)
      publish()
    })
  }

  return {
    subscribe(listener) {
      listener(comments.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async add(eventId, text) {
      const comment = buildComment(eventId, text, actor())
      persist([...comments, comment])
      return comment
    },
    async remove(id) {
      if (!comments.some((comment) => comment.id === id)) throw new DomainError('not-found')
      persist(comments.filter((comment) => comment.id !== id))
    },
  }
}

function readComments(storage: KeyValueStorage, key: string): ActivityComment[] {
  const raw = storage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      const comment = parseStoredComment(entry)
      return comment ? [comment] : []
    })
  } catch {
    return []
  }
}

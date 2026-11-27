import { buildComment, parseStoredComment, type ActivityComment } from '../domain/activityComments.ts'
import type { ActivityActor } from '../domain/activity.ts'
import { DomainError } from '../domain/errors.ts'
import { createLocalList } from './records.ts'
import type { KeyValueStorage } from './storage.ts'

export interface ActivityCommentRepository {
  subscribe(listener: (comments: ActivityComment[]) => void, onError?: (error: unknown) => void): () => void
  add(eventId: string, text: string): Promise<ActivityComment>
  remove(id: string): Promise<void>
}

export function createLocalActivityCommentRepository(
  storage: KeyValueStorage,
  actor: () => ActivityActor,
  key = 'wedding-planner.activityComments.v1',
): ActivityCommentRepository {
  const list = createLocalList(storage, key, parseStoredComment)
  const ordered = (comments: ActivityComment[]) => comments.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return {
    subscribe: (listener) => list.subscribe((comments) => listener(ordered(comments))),
    async add(eventId, text) {
      const comment = buildComment(eventId, text, actor())
      list.save([...list.items(), comment])
      return comment
    },
    async remove(id) {
      if (!list.items().some((comment) => comment.id === id)) throw new DomainError('not-found')
      list.save(list.items().filter((comment) => comment.id !== id))
    },
  }
}

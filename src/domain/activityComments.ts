import { ValidationError } from './errors.ts'
import { isWeddingRole, type WeddingRoleId } from './roles.ts'
import type { ActivityActor } from './activity.ts'

export const COMMENT_TEXT_MAX = 1000

export interface ActivityComment {
  id: string
  eventId: string
  text: string
  actorEmail: string
  actorName: string
  actorRole: WeddingRoleId | null
  actorPhotoUrl: string
  createdAt: string
}

export function normalizeCommentText(text: string): string {
  const trimmed = text.normalize('NFC').trim()
  if (!trimmed) throw new ValidationError(['comment-empty'])
  if (trimmed.length > COMMENT_TEXT_MAX) throw new ValidationError(['comment-length'])
  return trimmed
}

export function buildComment(
  eventId: string,
  text: string,
  actor: ActivityActor,
  id: string = crypto.randomUUID(),
  createdAt: string = new Date().toISOString(),
): ActivityComment {
  const event = eventId.trim()
  if (!event) throw new ValidationError(['comment-event'])
  return {
    id,
    eventId: event.slice(0, 180),
    text: normalizeCommentText(text),
    actorEmail: actor.email.trim().toLowerCase(),
    actorName: (actor.name.trim() || actor.email || 'מכשיר זה').slice(0, 180),
    actorRole: actor.role,
    actorPhotoUrl: actor.photoUrl.trim().slice(0, 900),
    createdAt,
  }
}

export function parseStoredComment(value: unknown): ActivityComment | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) return null
  if (typeof record.eventId !== 'string' || record.eventId.length === 0) return null
  if (typeof record.text !== 'string' || record.text.trim().length === 0) return null
  if (record.text.length > COMMENT_TEXT_MAX) return null
  return {
    id: record.id,
    eventId: record.eventId,
    text: record.text.trim(),
    actorEmail: typeof record.actorEmail === 'string' ? record.actorEmail : '',
    actorName: typeof record.actorName === 'string' ? record.actorName : '',
    actorRole: isWeddingRole(record.actorRole) ? record.actorRole : null,
    actorPhotoUrl: typeof record.actorPhotoUrl === 'string' ? record.actorPhotoUrl : '',
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
  }
}

export function commentsForEvent(
  comments: readonly ActivityComment[],
  eventId: string,
): ActivityComment[] {
  return comments
    .filter((comment) => comment.eventId === eventId)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

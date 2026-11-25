import { describe, expect, it } from 'vitest'
import { ValidationError } from './errors.ts'
import {
  buildComment,
  commentsForEvent,
  normalizeCommentText,
  parseStoredComment,
} from './activityComments.ts'

const actor = { email: 'rina@example.com', name: 'רינה לוי', role: 'groom_mother' as const, photoUrl: '' }

describe('activity comments', () => {
  it('normalizes and rejects empty or oversized text', () => {
    expect(normalizeCommentText('  היי  ')).toBe('היי')
    expect(() => normalizeCommentText('   ')).toThrow(ValidationError)
    expect(() => normalizeCommentText('x'.repeat(1001))).toThrow(ValidationError)
  })

  it('builds a comment for an activity event', () => {
    const comment = buildComment('event-1', 'מזל טוב!', actor, 'c1', '2026-11-25T10:00:00.000Z')
    expect(comment).toMatchObject({
      id: 'c1',
      eventId: 'event-1',
      text: 'מזל טוב!',
      actorEmail: 'rina@example.com',
      actorName: 'רינה לוי',
      actorRole: 'groom_mother',
      createdAt: '2026-11-25T10:00:00.000Z',
    })
  })

  it('parses stored comments and groups them by event in order', () => {
    const first = parseStoredComment({
      id: 'a',
      eventId: 'e1',
      text: 'ראשון',
      actorEmail: 'a@example.com',
      actorName: 'א',
      actorRole: 'groom',
      actorPhotoUrl: '',
      createdAt: '2026-11-25T09:00:00.000Z',
    })
    const second = parseStoredComment({
      id: 'b',
      eventId: 'e1',
      text: 'שני',
      actorEmail: 'b@example.com',
      actorName: 'ב',
      actorRole: 'bride',
      actorPhotoUrl: '',
      createdAt: '2026-11-25T10:00:00.000Z',
    })
    const other = parseStoredComment({
      id: 'c',
      eventId: 'e2',
      text: 'אחר',
      actorEmail: 'c@example.com',
      actorName: 'ג',
      actorRole: null,
      actorPhotoUrl: '',
      createdAt: '2026-11-25T11:00:00.000Z',
    })
    expect(parseStoredComment({ id: 'bad' })).toBeNull()
    expect(commentsForEvent([second!, other!, first!], 'e1').map((item) => item.id)).toEqual(['a', 'b'])
  })
})

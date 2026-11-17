import { describe, expect, it } from 'vitest'
import {
  countdownLabel,
  describeActivity,
  emptyDetails,
  groupActivityByDay,
  guestActivity,
  importActivity,
  relativeTime,
  roleIsFeminine,
  unreadCount,
  type ActivityEvent,
} from './activity.ts'
import { makeGuest } from './makeGuest.ts'

function event(partial: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: '1',
    type: 'guest_added',
    entity: 'guest',
    entityId: 'g1',
    entityName: 'יוסי מפקידון',
    actorEmail: 'rina@example.com',
    actorName: 'רינה לוי',
    actorRole: 'groom_mother',
    actorPhotoUrl: '',
    createdAt: '2026-11-17T10:00:00.000Z',
    ...partial,
    details: emptyDetails(partial.details),
  }
}

describe('activity sentences', () => {
  it('uses a feminine verb for a mother and a masculine verb for a father', () => {
    expect(roleIsFeminine('bride')).toBe(true)
    expect(roleIsFeminine('groom_brother')).toBe(false)
    expect(describeActivity(event({ type: 'guest_added', entityName: 'יוסי מפקידון' }))).toBe(
      'אמא של החתן (רינה) הוסיפה את יוסי מפקידון לרשימת המוזמנים',
    )
    expect(
      describeActivity(event({ type: 'guest_added', entityName: 'יוסי מפקידון', actorRole: 'groom_father', actorName: 'משה לוי' })),
    ).toBe('אבא של החתן (משה) הוסיף את יוסי מפקידון לרשימת המוזמנים')
  })

  it('describes an RSVP change and a contacts import', () => {
    expect(
      describeActivity(event({
        type: 'rsvp_changed',
        entity: 'rsvp',
        entityName: 'יוסי מפקידון',
        details: emptyDetails({ from: 'pending', to: 'attending' }),
      })),
    ).toBe('אמא של החתן (רינה) שינתה את האישור של יוסי מפקידון מממתין למגיע')
    const imported = importActivity([
      { id: 'a', fullName: 'יוסי' },
      { id: 'b', fullName: 'דנה' },
    ])
    expect(describeActivity(event({ type: 'guests_imported', entityName: imported.entityName, details: emptyDetails(imported.details) }))).toBe(
      'אמא של החתן (רינה) ייבאה 2 אנשי קשר, בהם יוסי, דנה',
    )
  })

  it('splits an RSVP change from other guest edits', () => {
    const before = makeGuest({ id: 'g1', fullName: 'יוסי', rsvp: 'pending', phone: '050' })
    const after = makeGuest({ id: 'g1', fullName: 'יוסי לוי', rsvp: 'attending', phone: '050' })
    expect(guestActivity(before, after).map((item) => item.type)).toEqual(['rsvp_changed', 'guest_edited'])
  })

  it('formats Hebrew relative time, day groups, countdown, and unread', () => {
    const now = new Date('2026-11-17T12:00:00')
    expect(relativeTime(new Date(now.getTime() - 5 * 60000).toISOString(), now)).toBe('לפני 5 דקות')
    expect(relativeTime(new Date(now.getTime() - 26 * 3600000).toISOString(), now)).toBe('אתמול')
    const events = [
      event({ createdAt: '2026-11-17T09:00:00' }),
      event({ id: '2', createdAt: '2026-11-16T09:00:00' }),
    ]
    expect(groupActivityByDay(events, now).map((group) => group.label)).toEqual(['היום', 'אתמול'])
    expect(countdownLabel('2026-11-20', now)).toBe('בעוד 3 ימים')
    expect(unreadCount(events, '2026-11-16T12:00:00')).toBe(1)
    expect(unreadCount(events, null)).toBe(2)
  })
})

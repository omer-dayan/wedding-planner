import { describe, expect, it } from 'vitest'
import rules from '../../firestore.rules?raw'

describe('firestore rules', () => {
  it('limits wedding access to verified members of that wedding', () => {
    expect(rules).toContain('email_verified')
    expect(rules).toContain('memberEmails')
    expect(rules).toContain('memberRoles')
    expect(rules).toContain('groom_brother')
    expect(rules).toContain('match /songs/{songId}')
    expect(rules).toContain('match /venues/{venueId}')
    expect(rules).toContain('match /activity/{eventId}')
    expect(rules).toContain('weddingDate')
    expect(rules).toContain('actorEmail == myEmail()')
    expect(rules).toContain('allow update: if false')
    expect(rules).toContain('addedByEmail == myEmail().lower()')
    expect(rules).toContain('canModerate')
    expect(rules).toContain('request.auth.token.email')
    expect(rules).toContain('match /weddings/{weddingId}')
    expect(rules).toContain('match /guests/{guestId}')
    expect(rules).toContain('isOwner(weddingId)')
    expect(rules).not.toContain('allow read, write: if true')
  })
})

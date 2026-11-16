import { describe, expect, it } from 'vitest'
import rules from '../../firestore.rules?raw'

describe('firestore rules', () => {
  it('limits wedding access to verified members of that wedding', () => {
    expect(rules).toContain('email_verified')
    expect(rules).toContain('memberEmails')
    expect(rules).toContain('request.auth.token.email')
    expect(rules).toContain('match /weddings/{weddingId}')
    expect(rules).toContain('match /guests/{guestId}')
    expect(rules).toContain('resource.data.ownerEmail == myEmail()')
    expect(rules).not.toContain('allow read, write: if true')
  })
})

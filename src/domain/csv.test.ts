import { describe, expect, it } from 'vitest'
import { guestsToAppCsv } from './csv.ts'
import { makeGuest } from './makeGuest.ts'

describe('app csv', () => {
  it('writes a UTF-8 BOM, Hebrew labels, and quotes cells with commas and quotes', () => {
    const csv = guestsToAppCsv([makeGuest({
      id: 'abc',
      fullName: 'דנה כהן',
      side: 'bride',
      rsvp: 'attending',
      notes: 'שורה, עם "ציטוט"',
    })])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('שם מלא')
    expect(csv).not.toContain('חתן')
    expect(csv).toContain('כלה')
    expect(csv).toContain('מגיע')
    expect(csv).toContain('"שורה, עם ""ציטוט"""')
  })
})

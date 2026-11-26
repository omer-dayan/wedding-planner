import { describe, expect, it } from 'vitest'
import { guestsToAppCsv, parseAppCsv, parseCsv } from './csv.ts'
import { makeGuest } from './makeGuest.ts'

describe('app csv', () => {
  it('writes a UTF-8 BOM and round-trips Hebrew, commas and quotes', () => {
    const guest = makeGuest({
      id: 'abc',
      fullName: 'דנה כהן',
      phone: '050-1234567',
      side: 'bride',
      group: 'חברים / חברים צבא',
      partySize: 3,
      partySizeAssumed: true,
      rsvp: 'attending',
      notes: 'שורה, עם "ציטוט"',
    })
    const csv = guestsToAppCsv([guest])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('שם מלא')
    expect(csv).not.toContain('חתן')
    expect(csv).toContain('כלה')
    expect(csv).toContain('מגיע')

    const parsed = parseAppCsv(csv)
    expect(parsed.fatal).toBeNull()
    expect(parsed.errors).toEqual([])
    expect(parsed.records).toEqual([
      {
        id: 'abc',
        fullName: 'דנה כהן',
        phone: '050-1234567',
        side: 'bride',
        group: 'חברים / חברים צבא',
        partySize: 3,
        partySizeAssumed: true,
        rsvp: 'attending',
        notes: 'שורה, עם "ציטוט"',
        role: null,
        subSide: 'none',
        category: 'other',
        categoryId: '',
      },
    ])
  })

  it('treats an empty side as unspecified and accepts semicolon exports', () => {
    const parsed = parseAppCsv('שם מלא;צד;מספר אנשים;סטטוס הגעה\nיוסי לוי;;2;לא מגיע\n')
    expect(parsed.fatal).toBeNull()
    expect(parsed.records[0]).toMatchObject({
      fullName: 'יוסי לוי',
      side: null,
      partySize: 2,
      rsvp: 'declined',
      partySizeAssumed: false,
    })
  })

  it('rejects a sheet-shaped file that has no app header', () => {
    expect(parseAppCsv('חברים,חברים צבא,יוסי לוי,1\n').fatal).toBe('missing-header')
  })

  it('keeps quoted newlines inside a single field', () => {
    const rows = parseCsv('שם,הערות\r\n"דנה","שורה אחת\r\nשורה שנייה"\r\n')
    expect(rows[1]).toEqual(['דנה', 'שורה אחת\r\nשורה שנייה'])
  })
})

import { describe, expect, it } from 'vitest'
import sampleSheet from '../../test/fixtures/sample_sheet.csv?raw'
import { fetchGoogleSheetCsv, parseGoogleSheetCsv, toGoogleSheetsCsvExportUrl } from './googleSheet.ts'

describe('google sheet csv', () => {
  it('parses the sample sheet: carried groups, trimmed names, assumed counts', () => {
    const parsed = parseGoogleSheetCsv(sampleSheet)
    expect(parsed.fatal).toBeNull()
    expect(parsed.errors).toEqual([])
    expect(parsed.skippedHeaderRows).toBe(3)
    expect(parsed.guests).toEqual([
      { fullName: 'ישראל ישראלי', group: 'חברים / חברים בית ספר', partySize: 4, partySizeAssumed: false },
      { fullName: 'דנה כהן', group: 'חברים / חברים בית ספר', partySize: 2, partySizeAssumed: false },
      { fullName: 'יוסי לוי', group: 'חברים / חברים צבא', partySize: 1, partySizeAssumed: false },
      { fullName: 'נועה מזרחי', group: 'חברים / חברים צבא', partySize: 3, partySizeAssumed: false },
      { fullName: 'אבי ברק', group: 'עבודה', partySize: 1, partySizeAssumed: false },
      { fullName: 'רותם שגיא', group: 'עבודה', partySize: 1, partySizeAssumed: true },
    ])
    expect(parsed.guests[3].fullName.endsWith(' ')).toBe(false)
  })

  it('resets the sub-category when a new category starts', () => {
    const parsed = parseGoogleSheetCsv('קטגוריה א,תת א,אדם אחד,1\nקטגוריה ב,,אדם שניים,2\n')
    expect(parsed.guests.map((guest) => guest.group)).toEqual(['קטגוריה א / תת א', 'קטגוריה ב'])
  })

  it('uses a header row to define the group of the following guest', () => {
    const parsed = parseGoogleSheetCsv('משפחה,קרובים,,\n,,דוד כהן,2\n')
    expect(parsed.skippedHeaderRows).toBe(1)
    expect(parsed.guests[0]).toMatchObject({ fullName: 'דוד כהן', group: 'משפחה / קרובים', partySize: 2 })
  })

  it('flags an empty count and skips an invalid one', () => {
    const assumed = parseGoogleSheetCsv('עבודה,,רותם שגיא,\n')
    expect(assumed.guests[0]).toMatchObject({ partySize: 1, partySizeAssumed: true })

    const invalid = parseGoogleSheetCsv('עבודה,,רותם שגיא,אין\n')
    expect(invalid.guests).toEqual([])
    expect(invalid.errors).toEqual([{ line: 1, code: 'invalid-count' }])
  })

  it('keeps one guest when the sheet repeats a name', () => {
    const parsed = parseGoogleSheetCsv('חברים,א,יוסי לוי,1\nחברים,ב,יוסי לוי,4\n')
    expect(parsed.duplicateNames).toBe(1)
    expect(parsed.guests).toEqual([
      { fullName: 'יוסי לוי', group: 'חברים / ב', partySize: 4, partySizeAssumed: false },
    ])
  })

  it('refuses the app export format', () => {
    expect(parseGoogleSheetCsv('מזהה,שם מלא,טלפון\n1,דנה,\n').fatal).toBe('app-csv')
  })
})

describe('google sheet url', () => {
  it('converts a share link to the public csv export url', () => {
    expect(toGoogleSheetsCsvExportUrl('https://docs.google.com/spreadsheets/d/abc123-_XYZ/edit?usp=sharing')).toBe(
      'https://docs.google.com/spreadsheets/d/abc123-_XYZ/export?format=csv',
    )
    expect(toGoogleSheetsCsvExportUrl('https://docs.google.com/spreadsheets/d/abc123-_XYZ/edit#gid=42')).toBe(
      'https://docs.google.com/spreadsheets/d/abc123-_XYZ/export?format=csv&gid=42',
    )
  })

  it('rejects a link that is not a google sheet', () => {
    expect(() => toGoogleSheetsCsvExportUrl('https://example.com/sheet')).toThrow(/invalid-url/)
  })

  it('fetches the export url and rejects html login pages', async () => {
    let requested = ''
    const text = await fetchGoogleSheetCsv(
      'https://docs.google.com/spreadsheets/d/abcXYZ_1/edit?usp=sharing',
      async (input) => {
        requested = String(input)
        return new Response('חברים,,דנה,2\n')
      },
    )
    expect(requested).toBe('https://docs.google.com/spreadsheets/d/abcXYZ_1/export?format=csv')
    expect(text).toContain('דנה')

    await expect(
      fetchGoogleSheetCsv('https://docs.google.com/spreadsheets/d/abc/edit', async () => new Response('<html></html>')),
    ).rejects.toMatchObject({ code: 'not-csv' })
    await expect(
      fetchGoogleSheetCsv('https://docs.google.com/spreadsheets/d/abc/edit', async () => new Response('no', { status: 403 })),
    ).rejects.toMatchObject({ code: 'http' })
    await expect(
      fetchGoogleSheetCsv('https://docs.google.com/spreadsheets/d/abc/edit', async () => {
        throw new Error('offline')
      }),
    ).rejects.toMatchObject({ code: 'network' })
  })
})

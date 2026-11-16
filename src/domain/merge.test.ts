import { describe, expect, it } from 'vitest'
import sampleSheet from '../../test/fixtures/sample_sheet.csv?raw'
import { parseAppCsv } from './csv.ts'
import { parseGoogleSheetCsv } from './googleSheet.ts'
import { makeGuest } from './makeGuest.ts'
import { applyAppCsvImport, applySheetImport } from './merge.ts'

const clock = {
  now: () => '2026-02-02T00:00:00.000Z',
  createId: (() => {
    let index = 0
    return () => `new-${++index}`
  })(),
}

describe('sheet re-import', () => {
  it('updates an existing guest by name and does not duplicate on a second import', () => {
    const existing = [
      makeGuest({
        id: 'keep',
        fullName: 'נועה מזרחי',
        phone: '050',
        side: 'bride',
        rsvp: 'attending',
        notes: 'ליד המשפחה',
        group: 'ישן',
        partySize: 9,
      }),
    ]
    const incoming = parseGoogleSheetCsv(sampleSheet).guests
    const first = applySheetImport(existing, incoming, clock)
    expect(first.created).toBe(5)
    expect(first.updated).toBe(1)
    expect(first.assumed).toBe(1)
    expect(first.guests).toHaveLength(6)
    expect(first.guests.find((guest) => guest.id === 'keep')).toMatchObject({
      fullName: 'נועה מזרחי',
      phone: '050',
      side: 'bride',
      rsvp: 'attending',
      notes: 'ליד המשפחה',
      group: 'חברים / חברים צבא',
      partySize: 3,
      partySizeAssumed: false,
      createdAt: existing[0].createdAt,
    })
    expect(first.guests.find((guest) => guest.fullName === 'רותם שגיא')).toMatchObject({
      partySize: 1,
      partySizeAssumed: true,
      rsvp: 'pending',
      side: null,
    })

    const second = applySheetImport(first.guests, incoming, {
      now: () => '2026-03-03T00:00:00.000Z',
      createId: () => {
        throw new Error('should not create')
      },
    })
    expect(second.created).toBe(0)
    expect(second.updated).toBe(6)
    expect(second.guests).toHaveLength(6)
    expect(second.guests.find((guest) => guest.id === 'keep')?.rsvp).toBe('attending')
  })
})

describe('app csv re-import', () => {
  it('updates by id when present and by name when the id is absent', () => {
    const existing = [makeGuest({ id: '1', fullName: 'ישן', phone: '111' })]
    const byId = applyAppCsvImport(
      existing,
      [
        {
          id: '1',
          fullName: 'חדש',
          phone: '222',
          side: 'groom',
          group: 'משפחה',
          partySize: 4,
          partySizeAssumed: false,
          rsvp: 'attending',
          notes: 'עודכן',
        },
      ],
      clock,
    )
    expect(byId.updated).toBe(1)
    expect(byId.guests[0]).toMatchObject({
      id: '1',
      fullName: 'חדש',
      phone: '222',
      side: 'groom',
      rsvp: 'attending',
      createdAt: existing[0].createdAt,
    })

    const byName = applyAppCsvImport(byId.guests, [
      {
        fullName: 'חדש',
        phone: '333',
        side: 'groom',
        group: 'משפחה',
        partySize: 4,
        partySizeAssumed: true,
        rsvp: 'maybe',
        notes: '',
      },
    ])
    expect(byName.created).toBe(0)
    expect(byName.guests).toHaveLength(1)
    expect(byName.guests[0]).toMatchObject({ id: '1', phone: '333', rsvp: 'maybe', partySizeAssumed: true })
  })

  it('round-trips an export back onto the same ids', () => {
    const existing = [makeGuest({ id: 'a', fullName: 'אבי ברק', partySize: 2, side: 'shared' })]
    const exported = parseAppCsv(
      `מזהה,שם מלא,טלפון,צד,קבוצה,מספר אנשים,מספר לא צוין,סטטוס הגעה,הערות\n${existing[0].id},אבי ברק,,משותף,עבודה,5,לא,ממתין,\n`,
    )
    const merged = applyAppCsvImport(existing, exported.records)
    expect(merged.created).toBe(0)
    expect(merged.updated).toBe(1)
    expect(merged.guests[0]).toMatchObject({ id: 'a', partySize: 5, group: 'עבודה', side: 'shared' })
  })
})

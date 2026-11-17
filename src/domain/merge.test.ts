import { describe, expect, it } from 'vitest'
import { parseAppCsv } from './csv.ts'
import { makeGuest } from './makeGuest.ts'
import { applyAppCsvImport } from './merge.ts'

const clock = {
  now: () => '2026-02-02T00:00:00.000Z',
  createId: (() => {
    let index = 0
    return () => `new-${++index}`
  })(),
}

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
          role: null,
          subSide: 'none',
          category: 'other',
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
        role: null,
        subSide: 'none',
        category: 'other',
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

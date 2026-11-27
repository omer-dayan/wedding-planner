import { describe, expect, it } from 'vitest'
import { addBlockedDays, blockedOn, daysInRange, normalizeBlockedDates, readBlockedDates } from './blockedDates.ts'

describe('blocked dates', () => {
  it('sorts, drops invalid and duplicate days', () => {
    const list = normalizeBlockedDates([
      { id: 'a', date: '2026-07-02', reason: ' חופשה ' },
      { id: 'b', date: '2026-02-30', reason: 'לא קיים' },
      { id: 'c', date: '2026-07-02', reason: 'כפול' },
      { id: 'd', date: '2026-06-01', reason: '' },
    ])
    expect(list.map((entry) => entry.date)).toEqual(['2026-06-01', '2026-07-02'])
    expect(list[1].reason).toBe('חופשה')
  })

  it('finds a blocked day and treats an empty date as free', () => {
    const list = readBlockedDates([{ id: 'a', date: '2026-07-02', reason: 'מילואים' }])
    expect(blockedOn(list, '2026-07-02')?.reason).toBe('מילואים')
    expect(blockedOn(list, '2026-07-03')).toBeNull()
    expect(blockedOn(list, '')).toBeNull()
  })

  it('expands a range and refuses a backwards or oversized one', () => {
    expect(daysInRange('2026-07-30', '2026-08-02')).toEqual(['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02'])
    expect(daysInRange('2026-07-30', '')).toEqual(['2026-07-30'])
    expect(daysInRange('2026-07-30', '2026-07-01')).toEqual([])
    expect(daysInRange('2026-01-01', '2026-12-31')).toEqual([])
  })

  it('keeps the existing entry when a day is added twice', () => {
    const first = addBlockedDays([], ['2026-07-02'], 'מילואים')
    const again = addBlockedDays(first, ['2026-07-02', '2026-07-03'], 'אחר')
    expect(again.map((entry) => [entry.date, entry.reason])).toEqual([['2026-07-02', 'מילואים'], ['2026-07-03', 'אחר']])
  })
})

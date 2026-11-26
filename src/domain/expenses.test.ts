import { describe, expect, it } from 'vitest'
import { expenseTotal, formatShekels, normalizeExpense, parseShekels } from './expenses.ts'

describe('expenses', () => {
  it('reads shekels into agorot and prints them back', () => {
    expect(parseShekels('1500')).toBe(150000)
    expect(parseShekels('1,500.50')).toBe(150050)
    expect(parseShekels('12,5')).toBe(1250)
    expect(parseShekels('0')).toBeNull()
    expect(formatShekels(150050)).toBe('1,500.50 ₪')
    expect(formatShekels(150000)).toBe('1,500 ₪')
  })

  it('sums a documented list', () => {
    const hall = normalizeExpense({ title: 'מקדמה לאולם', amount: 500000, category: 'venue', paidOn: '2026-06-01', notes: '' })
    const photo = normalizeExpense({ title: 'צלם', amount: 200000, category: 'photo', paidOn: '', notes: '' })
    expect(expenseTotal([hall, photo])).toBe(700000)
    expect(() => normalizeExpense({ ...hall, amount: 0 })).toThrow(/expense-amount/)
  })
})
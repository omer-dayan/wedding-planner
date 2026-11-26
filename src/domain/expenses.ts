import { ValidationError } from './errors.ts'

export const EXPENSE_CATEGORIES = [
  { id: 'venue', label: 'אולם' },
  { id: 'photo', label: 'צילום' },
  { id: 'music', label: 'מוזיקה' },
  { id: 'attire', label: 'לבוש' },
  { id: 'food', label: 'אוכל' },
  { id: 'invites', label: 'הזמנות' },
  { id: 'other', label: 'אחר' },
] as const

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]['id']

export interface ExpenseDraft {
  title: string
  /** Whole shekels plus agorot, stored as agorot. */
  amount: number
  category: ExpenseCategoryId
  paidOn: string
  notes: string
}

export interface Expense extends ExpenseDraft {
  id: string
  addedByEmail: string
  createdAt: string
  updatedAt: string
}

export function isExpenseCategory(value: unknown): value is ExpenseCategoryId {
  return typeof value === 'string' && EXPENSE_CATEGORIES.some((item) => item.id === value)
}

export function expenseCategoryLabel(category: ExpenseCategoryId): string {
  return EXPENSE_CATEGORIES.find((item) => item.id === category)?.label ?? 'אחר'
}

export function parseShekels(value: string): number | null {
  const cleaned = value.trim().replace(/₪/g, '').replace(/\s/g, '')
  if (!cleaned) return null
  let normalized = cleaned
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) normalized = cleaned.replace(/,/g, '')
  else if (/^\d+,\d{1,2}$/.test(cleaned)) normalized = cleaned.replace(',', '.')
  else if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const agorot = Number(whole) * 100 + Number((fraction + '00').slice(0, 2))
  if (!Number.isSafeInteger(agorot) || agorot < 1 || agorot > 1_000_000_000) return null
  return agorot
}

export function formatShekels(agorot: number): string {
  const whole = Math.trunc(agorot / 100)
  const fraction = Math.abs(agorot % 100)
  const text = whole.toLocaleString('he-IL')
  return fraction === 0 ? `${text} ₪` : `${text}.${String(fraction).padStart(2, '0')} ₪`
}

export function shekelsInputValue(agorot: number): string {
  const whole = Math.trunc(agorot / 100)
  const fraction = Math.abs(agorot % 100)
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`
}

export function expenseTotal(expenses: readonly Pick<Expense, 'amount'>[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0)
}

export function normalizeExpense(input: ExpenseDraft): ExpenseDraft {
  const title = input.title.trim().replace(/\s+/g, ' ')
  const notes = input.notes.trim()
  const paidOn = input.paidOn.trim()
  const errors: string[] = []
  if (!title) errors.push('expense-title')
  if (title.length > 160) errors.push('expense-title')
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > 1_000_000_000) errors.push('expense-amount')
  if (!isExpenseCategory(input.category)) errors.push('expense-category')
  if (paidOn && !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) errors.push('expense-date')
  if (notes.length > 2000) errors.push('notes-length')
  if (errors.length > 0) throw new ValidationError(errors)
  return { title, amount: input.amount, category: input.category, paidOn, notes }
}

export function parseStoredExpense(value: unknown): Expense | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id) return null
  try {
    const draft = normalizeExpense({
      title: typeof record.title === 'string' ? record.title : '',
      amount: typeof record.amount === 'number' ? record.amount : Number.NaN,
      category: isExpenseCategory(record.category) ? record.category : 'other',
      paidOn: typeof record.paidOn === 'string' ? record.paidOn : '',
      notes: typeof record.notes === 'string' ? record.notes : '',
    })
    return {
      id: record.id,
      ...draft,
      addedByEmail: typeof record.addedByEmail === 'string' ? record.addedByEmail : '',
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function compareExpenses(left: Expense, right: Expense): number {
  if (left.paidOn !== right.paidOn) {
    if (!left.paidOn) return 1
    if (!right.paidOn) return -1
    return right.paidOn.localeCompare(left.paidOn)
  }
  return right.createdAt.localeCompare(left.createdAt)
}

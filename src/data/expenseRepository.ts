import { expenseAddedInput, expenseDeletedInput } from '../domain/activity.ts'
import { DomainError } from '../domain/errors.ts'
import { normalizeExpense, parseStoredExpense, type Expense, type ExpenseDraft } from '../domain/expenses.ts'
import type { WeddingRoleId } from '../domain/roles.ts'
import { recordActivity, type ActivityLogger } from './activityLog.ts'
import type { KeyValueStorage } from './storage.ts'

export const EXPENSE_STORAGE_KEY = 'wedding-planner.expenses.v1'

export interface ExpenseAuthor {
  email: string
  name: string
  role: WeddingRoleId | null
}

export interface ExpenseRepository {
  subscribe(listener: (expenses: Expense[]) => void, onError?: (error: unknown) => void): () => void
  create(draft: ExpenseDraft, author: ExpenseAuthor): Promise<Expense>
  update(id: string, draft: ExpenseDraft): Promise<Expense>
  remove(id: string): Promise<void>
}

export function createLocalExpenseRepository(storage: KeyValueStorage, key = EXPENSE_STORAGE_KEY, logger?: ActivityLogger): ExpenseRepository {
  const listeners = new Set<(expenses: Expense[]) => void>()
  let expenses = readExpenses(storage, key)

  function persist(next: Expense[]) {
    try {
      storage.setItem(key, JSON.stringify(next))
    } catch {
      throw new DomainError('storage-full')
    }
    expenses = next
    for (const listener of listeners) listener(expenses)
  }

  return {
    subscribe(listener) {
      listener(expenses)
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async create(draft, author) {
      const normalized = normalizeExpense(draft)
      const timestamp = new Date().toISOString()
      const expense: Expense = {
        id: crypto.randomUUID(),
        ...normalized,
        addedByEmail: author.email.trim().toLowerCase(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      persist([...expenses, expense])
      recordActivity(logger, [expenseAddedInput(expense)])
      return expense
    },
    async update(id, draft) {
      const current = expenses.find((expense) => expense.id === id)
      if (!current) throw new DomainError('not-found')
      const expense: Expense = { ...current, ...normalizeExpense(draft), updatedAt: new Date().toISOString() }
      persist(expenses.map((item) => (item.id === id ? expense : item)))
      return expense
    },
    async remove(id) {
      const current = expenses.find((expense) => expense.id === id)
      if (!current) throw new DomainError('not-found')
      persist(expenses.filter((expense) => expense.id !== id))
      recordActivity(logger, [expenseDeletedInput(current)])
    },
  }
}

function readExpenses(storage: KeyValueStorage, key: string): Expense[] {
  const raw = storage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      const expense = parseStoredExpense(entry)
      return expense ? [expense] : []
    })
  } catch {
    return []
  }
}

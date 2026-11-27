import { expenseAddedInput, expenseDeletedInput } from '../domain/activity.ts'
import { normalizeExpense, parseStoredExpense, type Expense, type ExpenseDraft } from '../domain/expenses.ts'
import type { ActivityLogger } from './activityLog.ts'
import { createRecordRepository, localStore, type RecordRepository, type RecordSpec } from './records.ts'
import type { Author } from './songRepository.ts'
import type { KeyValueStorage } from './storage.ts'

export const EXPENSE_STORAGE_KEY = 'wedding-planner.expenses.v1'

export type ExpenseRepository = RecordRepository<Expense, ExpenseDraft, Author>

export const expenseSpec: RecordSpec<Expense, ExpenseDraft, Author> = {
  normalize: normalizeExpense,
  author: (author) => ({ addedByEmail: author.email.trim().toLowerCase() }),
  created: (expense) => [expenseAddedInput(expense)],
  removed: (expense) => [expenseDeletedInput(expense)],
}

export function createLocalExpenseRepository(storage: KeyValueStorage, key = EXPENSE_STORAGE_KEY, logger?: ActivityLogger): ExpenseRepository {
  return createRecordRepository(localStore(storage, key, parseStoredExpense, logger), expenseSpec)
}

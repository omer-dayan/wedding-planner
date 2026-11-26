import { collection, doc, getDoc, onSnapshot, writeBatch, type Firestore } from 'firebase/firestore'
import { expenseAddedInput, expenseDeletedInput } from '../domain/activity.ts'
import { DomainError } from '../domain/errors.ts'
import { normalizeExpense, parseStoredExpense, type Expense } from '../domain/expenses.ts'
import { recordActivity, type ActivityLogger } from './activityLog.ts'
import type { ExpenseRepository } from './expenseRepository.ts'

export function createFirestoreExpenseRepository(db: Firestore, weddingId: string, logger?: ActivityLogger): ExpenseRepository {
  const expenses = collection(db, 'weddings', weddingId, 'expenses')

  return {
    subscribe(listener, onError) {
      return onSnapshot(
        expenses,
        (snapshot) => {
          listener(
            snapshot.docs.flatMap((entry) => {
              const expense = parseStoredExpense({ ...entry.data(), id: entry.id })
              return expense ? [expense] : []
            }),
          )
        },
        (error) => onError?.(error),
      )
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
      const batch = writeBatch(db)
      batch.set(doc(expenses, expense.id), expenseToDoc(expense))
      recordActivity(logger, [expenseAddedInput(expense)], batch)
      await batch.commit()
      return expense
    },
    async update(id, draft) {
      const normalized = normalizeExpense(draft)
      const ref = doc(expenses, id)
      const current = await getDoc(ref)
      if (!current.exists()) throw new DomainError('not-found')
      const stored = parseStoredExpense({ ...current.data(), id })
      if (!stored) throw new DomainError('not-found')
      const expense: Expense = { ...stored, ...normalized, updatedAt: new Date().toISOString() }
      const batch = writeBatch(db)
      batch.update(ref, expenseToDoc(expense))
      await batch.commit()
      return expense
    },
    async remove(id) {
      const ref = doc(expenses, id)
      const current = await getDoc(ref)
      if (!current.exists()) throw new DomainError('not-found')
      const stored = parseStoredExpense({ ...current.data(), id })
      const batch = writeBatch(db)
      batch.delete(ref)
      if (stored) recordActivity(logger, [expenseDeletedInput(stored)], batch)
      await batch.commit()
    },
  }
}

function expenseToDoc(expense: Expense) {
  return {
    title: expense.title,
    amount: expense.amount,
    category: expense.category,
    paidOn: expense.paidOn,
    notes: expense.notes,
    addedByEmail: expense.addedByEmail,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  }
}

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppServices } from '../../app/useAppServices.ts'
import {
  compareExpenses,
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  expenseTotal,
  formatShekels,
  normalizeExpense,
  parseShekels,
  shekelsInputValue,
  type Expense,
  type ExpenseCategoryId,
  type ExpenseDraft,
} from '../../domain/expenses.ts'
import { assignedRole, isCoupleOrOwner } from '../../domain/roles.ts'
import { Dialog } from '../../ui/Dialog.tsx'
import { Fab } from '../../ui/Fab.tsx'
import { messageFrom } from '../../ui/messageFrom.ts'
import { OverflowMenu } from '../../ui/OverflowMenu.tsx'

export function ExpensesPage() {
  const app = useAppServices()
  const [expenses, setExpenses] = useState<Expense[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const manage = isCoupleOrOwner(app.wedding, app.user?.email ?? null)

  useEffect(() => {
    return app.expenses.subscribe(
      (next) => {
        setExpenses(next)
        setLoadError(null)
      },
      (failure) => setLoadError(messageFrom(failure)),
    )
  }, [app.expenses])

  const ordered = useMemo(() => (expenses ?? []).slice().sort(compareExpenses), [expenses])
  const total = expenseTotal(ordered)

  async function save(draft: ExpenseDraft) {
    setSaving(true)
    setError(null)
    try {
      if (editing && editing !== 'new') await app.expenses.update(editing.id, draft)
      else {
        await app.expenses.create(draft, {
          email: app.user?.email ?? '',
          name: app.user?.displayName ?? '',
          role: assignedRole(app.wedding, app.user?.email ?? null),
        })
      }
      setEditing(null)
    } catch (failure) {
      setError(messageFrom(failure))
      throw failure
    } finally {
      setSaving(false)
    }
  }

  async function remove(expense: Expense) {
    setError(null)
    try {
      await app.expenses.remove(expense.id)
    } catch (failure) {
      setError(messageFrom(failure))
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>הוצאות</h1>
          <p>כל מה ששולם לחתונה, בשקלים.</p>
        </div>
      </header>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {error && !editing && <p className="form-error" role="alert">{error}</p>}
      {!manage && <p className="hint">צפייה בלבד. הוספה ועריכה שמורות לחתן, לכלה ולבעלים.</p>}
      {expenses === null ? (
        <p className="hint">טוען הוצאות…</p>
      ) : (
        <>
          <article className="stat-card" data-testid="expense-total">
            <p className="stat-label">סה״כ</p>
            <p className="stat-value">{formatShekels(total)}</p>
            <p className="stat-hint">{ordered.length.toLocaleString('he-IL')} הוצאות</p>
          </article>
          {ordered.length === 0 ? (
            <div className="empty">
              <h2>עדיין אין הוצאות</h2>
              <p>הוסיפו את התשלום הראשון, והסכום יתעדכן.</p>
            </div>
          ) : (
            <ul className="expense-list">
              {ordered.map((expense) => (
                <li key={expense.id} className="expense-card">
                  <div className="expense-copy">
                    <h2>{expense.title}</h2>
                    <p>
                      {expenseCategoryLabel(expense.category)}
                      {expense.paidOn ? ` · ${formatPaidOn(expense.paidOn)}` : ''}
                    </p>
                    {expense.notes && <p className="cell-note">{expense.notes}</p>}
                  </div>
                  <strong className="expense-amount">{formatShekels(expense.amount)}</strong>
                  {manage && (
                    <OverflowMenu label={`פעולות עבור ${expense.title}`}>
                      <button type="button" role="menuitem" onClick={() => setEditing(expense)}>עריכה</button>
                      <button type="button" role="menuitem" className="menu-danger" onClick={() => setDeleting(expense)}>מחיקה</button>
                    </OverflowMenu>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {manage && <Fab label="הוספת הוצאה" onClick={() => setEditing('new')} />}
      <Dialog open={deleting !== null} title="מחיקת הוצאה" onClose={() => setDeleting(null)}>
        {deleting && (
          <div className="stack-form">
            <p>למחוק את {deleting.title}?</p>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleting(null)}>ביטול</button>
              <button type="button" className="btn btn-danger" onClick={() => { void remove(deleting); setDeleting(null) }}>מחיקה</button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog open={editing !== null} title={editing && editing !== 'new' ? 'עריכת הוצאה' : 'הוספת הוצאה'} onClose={() => setEditing(null)}>
        {editing && (
          <ExpenseForm
            key={editing === 'new' ? 'new' : editing.id}
            expense={editing === 'new' ? null : editing}
            saving={saving}
            onCancel={() => setEditing(null)}
            onSubmit={save}
          />
        )}
      </Dialog>
    </section>
  )
}

function ExpenseForm({
  expense,
  saving,
  onCancel,
  onSubmit,
}: {
  expense: Expense | null
  saving: boolean
  onCancel: () => void
  onSubmit: (draft: ExpenseDraft) => Promise<void>
}) {
  const [title, setTitle] = useState(expense?.title ?? '')
  const [amount, setAmount] = useState(expense ? shekelsInputValue(expense.amount) : '')
  const [category, setCategory] = useState<ExpenseCategoryId>(expense?.category ?? 'other')
  const [paidOn, setPaidOn] = useState(expense?.paidOn ?? '')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseShekels(amount)
    if (parsed === null) {
      setError('יש להזין סכום בשקלים, גדול מאפס.')
      return
    }
    try {
      await onSubmit(normalizeExpense({ title, amount: parsed, category, paidOn, notes }))
    } catch (failure) {
      setError(messageFrom(failure))
    }
  }

  return (
    <form className="stack-form" onSubmit={(event) => void handleSubmit(event)}>
      <label className="field">
        <span>על מה</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field">
        <span>סכום בשקלים</span>
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" dir="ltr" className="ltr-field" />
      </label>
      <label className="field">
        <span>קטגוריה</span>
        <select value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategoryId)}>
          {EXPENSE_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>תאריך תשלום</span>
        <input type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
      </label>
      <label className="field">
        <span>הערה</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>ביטול</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'שומר…' : 'שמירה'}</button>
      </div>
    </form>
  )
}

function formatPaidOn(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}.${month}.${year}`
}

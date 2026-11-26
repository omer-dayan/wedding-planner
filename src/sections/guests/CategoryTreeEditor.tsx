import { useState } from 'react'
import {
  canParent,
  createGuestCategory,
  flattenTree,
  normalizeGuestCategories,
  removeGuestCategory,
  type GuestCategory,
} from '../../domain/guestCategories.ts'
import { messageFrom } from '../../ui/messageFrom.ts'

export function CategoryTreeEditor({
  categories,
  onSave,
  onClose,
}: {
  categories: readonly GuestCategory[]
  onSave: (categories: GuestCategory[]) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<GuestCategory[]>(() => categories.map((category) => ({ ...category })))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const rows = flattenTree(draft)

  function add(parentId = '') {
    const created = createGuestCategory('', parentId)
    setDraft((current) => [...current, created])
    queueMicrotask(() => {
      const input = document.getElementById(`category-name-${created.id}`)
      input?.scrollIntoView({ block: 'center' })
      if (input instanceof HTMLInputElement) input.focus()
    })
  }

  function update(id: string, patch: Partial<GuestCategory>) {
    setDraft((current) => current.map((category) => (category.id === id ? { ...category, ...patch } : category)))
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (draft.some((category) => category.label.trim() === '')) {
        setError('לכל קטגוריה צריך שם.')
        setBusy(false)
        return
      }
      const next = normalizeGuestCategories(draft)
      await onSave(next)
      onClose()
    } catch (failure) {
      setError(messageFrom(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack-form">
      <p>חתן וכלה נשארים צד, לא קטגוריה. כאן בונים עץ: אנשים נכנסים לקטגוריה, וקטגוריה יכולה לשבת מתחת לקטגוריה אחרת.</p>
      {rows.length === 0 && <p className="hint">עדיין אין קטגוריות.</p>}
      <button type="button" className="btn btn-primary" disabled={busy || draft.length >= 40} onClick={() => add()}>
        קטגוריה חדשה
      </button>
      <ul className="question-editor">
        {rows.map(({ category, depth }) => (
          <li key={category.id} style={{ marginInlineStart: depth * 16 }}>
            <label className="field grow">
              <span className="visually-hidden">שם הקטגוריה</span>
              <input
                id={`category-name-${category.id}`}
                value={category.label}
                onChange={(event) => update(category.id, { label: event.target.value })}
                placeholder="למשל: משפחת אילוז"
              />
            </label>
            <label className="field">
              <span className="visually-hidden">שייך תחת</span>
              <select
                value={category.parentId}
                onChange={(event) => {
                  const parentId = event.target.value
                  if (!canParent(draft, category.id, parentId)) return
                  update(category.id, { parentId })
                }}
              >
                <option value="">ברמה הראשית</option>
                {draft.filter((item) => item.id !== category.id && canParent(draft, category.id, item.id)).map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <div className="question-actions">
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => add(category.id)}
              >
                תת-קטגוריה
              </button>
              <button
                type="button"
                className="btn btn-danger btn-small"
                onClick={() => setDraft((current) => removeGuestCategory(current, category.id).categories)}
              >
                מחיקה
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>ביטול</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'שומר…' : 'שמירת עץ'}</button>
      </div>
    </div>
  )
}

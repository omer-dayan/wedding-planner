import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  addBlockedDays,
  daysInRange,
  formatDateHe,
  isRealDate,
  MAX_BLOCKED_DATES,
  type BlockedDate,
} from '../../domain/blockedDates.ts'
import { useAction } from '../../ui/useAction.ts'

export function BlockedDatesPanel({
  dates,
  manage,
  onSave,
  onBack,
}: {
  dates: readonly BlockedDate[]
  manage: boolean
  onSave: ((dates: BlockedDate[]) => Promise<void>) | null
  onBack: () => void
}) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const { busy: saving, error, setError, run } = useAction()
  const canEdit = manage && onSave !== null

  async function save(next: BlockedDate[]) {
    if (!onSave) return
    await run(async () => {
      await onSave(next)
    })
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!isRealDate(start)) {
      setError('בחרו תאריך.')
      return
    }
    const days = daysInRange(start, end)
    if (days.length === 0) {
      setError('טווח התאריכים אינו תקין. אפשר לחסום עד 60 ימים בבת אחת.')
      return
    }
    if (dates.length + days.length > MAX_BLOCKED_DATES) {
      setError('יש יותר מדי תאריכים חסומים.')
      return
    }
    await save(addBlockedDays(dates, days, reason.trim()))
    setStart('')
    setEnd('')
    setReason('')
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="blocked-dates">
      <header className="page-header">
        <div>
          <h1>תאריכים חסומים</h1>
          <p>ימים שבהם אי אפשר להתחתן. הצעה מאולם בתאריך כזה מסומנת באדום.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>חזרה לאולמות</button>
      </header>
      {!canEdit && <p className="hint">צפייה בלבד. עריכה שמורה לחתן, לכלה ולבעלים.</p>}
      {canEdit && (
        <form className="blocked-form stack-form" onSubmit={(event) => void add(event)}>
          <div className="blocked-form-row">
            <label className="field">
              <span>מתאריך</span>
              <input type="date" value={start} onChange={(event) => setStart(event.target.value)} required />
            </label>
            <label className="field">
              <span>עד תאריך (לא חובה)</span>
              <input type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>סיבה (לא חובה)</span>
            <input value={reason} maxLength={80} onChange={(event) => setReason(event.target.value)} placeholder="למשל: חתונה של אחי" />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'שומר…' : 'חסימת תאריך'}
            </button>
          </div>
        </form>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {dates.length === 0 ? (
        <div className="empty">
          <h2>אין תאריכים חסומים</h2>
          <p>הוסיפו ימים שלא מתאימים לכם, והצעות מאולמות בימים האלה יסומנו באדום.</p>
        </div>
      ) : (
        <ul className="blocked-list">
          {dates.map((entry) => (
            <li key={entry.id} className={entry.date < today ? 'blocked-item blocked-item-past' : 'blocked-item'}>
              <div>
                <strong>{formatDateHe(entry.date)}</strong>
                {entry.reason && <span className="hint">{entry.reason}</span>}
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  disabled={saving}
                  aria-label={`הסרת החסימה מ-${formatDateHe(entry.date)}`}
                  onClick={() => void save(dates.filter((item) => item.id !== entry.id))}
                >
                  הסרה
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

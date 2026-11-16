import { useState } from 'react'
import type { FormEvent } from 'react'
import { PRESET_GROUPS, RSVP_LABELS, SIDE_LABELS } from '../../domain/labels.ts'
import { RSVP_STATUSES, SIDES } from '../../domain/types.ts'
import type { Guest, GuestDraft, RsvpStatus, Side } from '../../domain/types.ts'
import { normalizeDraft } from '../../domain/validation.ts'
import { messageFrom } from '../../ui/messageFrom.ts'

const CUSTOM_GROUP = '__custom__'

export function GuestForm({
  guest,
  groups,
  saving,
  onCancel,
  onSubmit,
  onDelete,
}: {
  guest: Guest | null
  groups: readonly string[]
  saving: boolean
  onCancel: () => void
  onSubmit: (draft: GuestDraft) => Promise<void>
  onDelete?: () => void
}) {
  const options = [...new Set([...PRESET_GROUPS, ...groups.filter(Boolean)])]
  const [fullName, setFullName] = useState(guest?.fullName ?? '')
  const [phone, setPhone] = useState(guest?.phone ?? '')
  const [side, setSide] = useState<Side | ''>(guest?.side ?? '')
  const [group, setGroup] = useState(guest?.group ?? '')
  const [customGroup, setCustomGroup] = useState(() => group !== '' && !options.includes(group))
  const [partySize, setPartySize] = useState(String(guest?.partySize ?? 1))
  const [rsvp, setRsvp] = useState<RsvpStatus>(guest?.rsvp ?? 'pending')
  const [notes, setNotes] = useState(guest?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsedSize = Number(partySize)
    try {
      const draft = normalizeDraft({
        fullName,
        phone,
        side: side || null,
        group,
        partySize: parsedSize,
        partySizeAssumed: false,
        rsvp,
        notes,
      })
      await onSubmit(draft)
    } catch (failure) {
      setError(messageFrom(failure))
    }
  }

  return (
    <form className="stack-form" onSubmit={(event) => void handleSubmit(event)}>
      {guest?.partySizeAssumed && (
        <p className="hint">בגיליון לא צוין מספר אנשים, והונח 1. שמירה תאשר את המספר שמופיע כאן.</p>
      )}
      <label className="field">
        <span>שם מלא</span>
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
      </label>
      <label className="field">
        <span>טלפון</span>
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
          inputMode="tel"
          dir="ltr"
          className="ltr-field"
        />
      </label>
      <label className="field">
        <span>צד</span>
        <select value={side} onChange={(event) => setSide(event.target.value as Side | '')}>
          <option value="">לא צוין</option>
          {SIDES.map((option) => (
            <option key={option} value={option}>
              {SIDE_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <label htmlFor="guest-group">קבוצה</label>
        <select
          id="guest-group"
          value={customGroup ? CUSTOM_GROUP : group}
          onChange={(event) => {
            const next = event.target.value
            if (next === CUSTOM_GROUP) {
              setCustomGroup(true)
              setGroup('')
              return
            }
            setCustomGroup(false)
            setGroup(next)
          }}
        >
          <option value="">ללא קבוצה</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={CUSTOM_GROUP}>קבוצה אחרת…</option>
        </select>
        {customGroup && (
          <input
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            placeholder="לדוגמה: חברים / חברים צבא"
            aria-label="שם הקבוצה"
          />
        )}
      </div>
      <label className="field">
        <span>מספר אנשים (כולל מלווים)</span>
        <input
          value={partySize}
          onChange={(event) => setPartySize(event.target.value)}
          inputMode="numeric"
          min={1}
          max={100}
          type="number"
        />
      </label>
      <label className="field">
        <span>סטטוס הגעה</span>
        <select value={rsvp} onChange={(event) => setRsvp(event.target.value as RsvpStatus)}>
          {RSVP_STATUSES.map((option) => (
            <option key={option} value={option}>
              {RSVP_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>הערות</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        {onDelete && (
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={saving}>
            מחיקה
          </button>
        )}
        <div className="form-actions-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            ביטול
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'שומר…' : 'שמירה'}
          </button>
        </div>
      </div>
    </form>
  )
}

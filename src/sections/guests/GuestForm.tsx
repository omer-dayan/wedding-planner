import { useState } from 'react'
import type { FormEvent } from 'react'
import { flattenTree, legacyCategory, type GuestCategory } from '../../domain/guestCategories.ts'
import { RSVP_LABELS, SIDE_LABELS, SUB_SIDE_LABELS, sideLabel } from '../../domain/labels.ts'
import { RSVP_STATUSES, SUB_SIDES } from '../../domain/types.ts'
import type { Guest, GuestDraft, RsvpStatus, SubSide } from '../../domain/types.ts'
import { normalizeDraft } from '../../domain/validation.ts'
import { messageFrom } from '../../ui/messageFrom.ts'

export function GuestForm({
  guest,
  saving,
  placement,
  canReclassify,
  categories,
  onCancel,
  onSubmit,
  onDelete,
}: {
  guest: Guest | null
  saving: boolean
  placement: { side: 'groom' | 'bride'; subSide: SubSide }
  canReclassify: boolean
  categories: readonly GuestCategory[]
  onCancel: () => void
  onSubmit: (draft: GuestDraft) => Promise<void>
  onDelete?: () => void
}) {
  const adding = guest === null
  const lockPlacement = adding || !canReclassify
  const [fullName, setFullName] = useState(guest?.fullName ?? '')
  const [phone, setPhone] = useState(guest?.phone ?? '')
  const [side, setSide] = useState<'groom' | 'bride'>(guest?.side === 'bride' ? 'bride' : placement.side)
  const [subSide, setSubSide] = useState<SubSide>(guest?.subSide ?? placement.subSide)
  const [categoryId, setCategoryId] = useState(guest?.categoryId ?? '')
  const [partySize, setPartySize] = useState(String(guest?.partySize ?? 1))
  const [rsvp, setRsvp] = useState<RsvpStatus>(guest?.rsvp ?? 'pending')
  const [notes, setNotes] = useState(guest?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const fixedSide = lockPlacement ? (adding ? placement.side : (guest?.side === 'bride' || guest?.side === 'groom' ? guest.side : placement.side)) : side
  const fixedSubSide = lockPlacement ? (adding ? placement.subSide : (guest?.subSide ?? placement.subSide)) : subSide

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsedSize = Number(partySize)
    try {
      const draft = normalizeDraft({
        fullName,
        phone,
        side: fixedSide,
        subSide: fixedSubSide,
        category: legacyCategory(categories, categoryId),
        categoryId,
        role: guest?.role ?? null,
        group: categories.find((item) => item.id === categoryId)?.label ?? '',
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
      <div className="field">
        <span>צד וקירבה</span>
        {lockPlacement ? (
          <p className="locked-placement">
            <span className="mini-chip">{sideLabel(fixedSide)}</span>
            <span className="mini-chip">{SUB_SIDE_LABELS[fixedSubSide]}</span>
          </p>
        ) : (
          <>
            <div className="segment" role="radiogroup" aria-label="צד">
              {(['groom', 'bride'] as const).map((item) => (
                <button key={item} type="button" className={side === item ? 'segment-on' : ''} aria-pressed={side === item} onClick={() => setSide(item)}>
                  {SIDE_LABELS[item]}
                </button>
              ))}
            </div>
            <div className="segment" role="radiogroup" aria-label="קירבה">
              {SUB_SIDES.map((item) => (
                <button key={item} type="button" className={subSide === item ? 'segment-on' : ''} aria-pressed={subSide === item} onClick={() => setSubSide(item)}>
                  {SUB_SIDE_LABELS[item]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <label className="field">
        <span>קטגוריה</span>
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">ללא קטגוריה</option>
          {flattenTree(categories).map(({ category, depth }) => (
            <option key={category.id} value={category.id}>
              {`${'– '.repeat(depth)}${category.label}`}
            </option>
          ))}
        </select>
      </label>
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

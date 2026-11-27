import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { displayMembers } from '../../domain/members.ts'
import { assignedRole, isCoupleOrOwner, roleLabel, WEDDING_ROLES } from '../../domain/roles.ts'
import type { WeddingRoleId } from '../../domain/roles.ts'
import {
  createVenueQuestion,
  inferredPricePart,
  normalizeVenueQuestions,
  PRICE_PART_LABELS,
  PRICE_PARTS,
  VENUE_QUESTION_TYPE_LABELS,
  VENUE_QUESTION_TYPES,
  type PricePart,
  type VenueQuestion,
  type VenueQuestionType,
} from '../../domain/venueQuestions.ts'
import { normalizeFamilyPlaces, type FamilyPlace } from '../../domain/geo.ts'
import { DEFAULT_PALETTE, derivePalette, type PaletteChoice } from '../../domain/palette.ts'
import { geocodeInIsrael } from '../../data/geocode.ts'
import { useAppServices } from '../../app/useAppServices.ts'
import { messageFrom } from '../../ui/messageFrom.ts'
import { useAction } from '../../ui/useAction.ts'

export function SettingsPage() {
  const app = useAppServices()
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<WeddingRoleId>('bride')
  const [status, setStatus] = useState<string | null>(null)
  const { busy, error, run: runAction } = useAction()

  if (app.mode === 'local' || !app.wedding || !app.user) {
    return (
      <section className="page">
        <header className="page-header">
          <div>
            <h1>הגדרות</h1>
            <p>איפה נשמרת רשימת המוזמנים.</p>
          </div>
        </header>
        <div className="panel">
          <h2>שמירה מקומית</h2>
          <p>
            לא הוגדר Firebase, ולכן הרשימה נשמרת רק בדפדפן הזה ולא מסתנכרנת בין המכשירים. כדי לשמור בענן ולשתף
            עם בן או בת הזוג, חברו פרויקט Firebase לפי ההוראות בקובץ README.
          </p>
        </div>
        <WeddingDateField date={app.weddingDate} onSave={app.onSetWeddingDate} />
        <PaletteEditor palette={app.palette} onSave={app.onSetPalette} />
        <FamilyPlacesEditor places={app.familyPlaces} onSave={app.onSetFamilyPlaces} />
        <VenueQuestionsEditor questions={app.venueQuestions} onSave={app.onSetVenueQuestions} />
        <BuildStamp />
      </section>
    )
  }

  const wedding = app.wedding
  const isOwner = wedding.ownerEmail.toLowerCase() === app.user.email.toLowerCase()
  const members = displayMembers(wedding.memberEmails, wedding.ownerEmail)

  async function run(action: () => Promise<void>, success: string) {
    setStatus(null)
    if (await runAction(action)) setStatus(success)
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>הגדרות</h1>
          <p>שיתוף הרשימה עם בן או בת הזוג.</p>
        </div>
      </header>

      {app.weddings.length > 1 && (
        <label className="field panel-field">
          <span>החתונה הפעילה</span>
          <select value={wedding.id} onChange={(event) => app.onSelectWedding?.(event.target.value)}>
            {app.weddings.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.ownerEmail}
              </option>
            ))}
          </select>
        </label>
      )}

      <WeddingNameForm
        key={`${wedding.id}:${wedding.name}`}
        initialName={wedding.name}
        isOwner={isOwner}
        busy={busy}
        onSave={(next) => {
          if (!app.onRenameWedding) return
          void run(() => app.onRenameWedding!(next), 'שם החתונה נשמר.')
        }}
      />

      <div className="panel stack-form">
        <h2>האימייל שלי</h2>
        <p>את הכתובת הזו מוסיפים לרשימת השותפים. היא צריכה להתאים לחשבון Google.</p>
        <input className="ltr-field" dir="ltr" readOnly value={app.user.email} aria-label="האימייל שלי" />
      </div>

      <div className="panel stack-form">
        <h2>שותפים</h2>
        {!isOwner && <p>אתם צופים בחתונה של {wedding.ownerEmail}. רק בעלי החתונה יכולים לעדכן את רשימת השותפים.</p>}
        {isOwner && (
          <form
            className="member-add"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              if (!app.onAddMember) return
              const next = email
              void run(async () => {
                await app.onAddMember!(next, newRole)
                setEmail('')
              }, 'השותף נוסף. אחרי שיתחברו עם Google הם יראו את אותה רשימה.')
            }}
          >
            <label className="field">
              <span>אימייל</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                dir="ltr"
                className="ltr-field"
                placeholder="name@gmail.com"
                autoComplete="email"
              />
            </label>
            <label className="field">
              <span>תפקיד</span>
              <select value={newRole} onChange={(event) => setNewRole(event.target.value as WeddingRoleId)} required>
                {WEDDING_ROLES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy || email.trim() === ''}>
              הוספה
            </button>
          </form>
        )}
        <ul className="member-list">
          {members.map((member) => {
            const roleName = roleLabel(assignedRole(wedding, member.email))
            return (
            <li key={member.email} className="member-row">
              <div className="member-id">
                <span className="ltr-inline" dir="ltr">
                  {member.email}
                </span>
                <div className="member-tags">
                  <span className={`badge ${member.role === 'owner' ? 'badge-side' : 'badge-pending'}`}>
                    {member.role === 'owner' ? 'בעלים' : 'שותף'}
                  </span>
                  <span className="badge badge-role">{roleName}</span>
                </div>
              </div>
              {isOwner && (
                <label className="field">
                  <span className="visually-hidden">תפקיד של {member.email}</span>
                  <select
                    value={assignedRole(wedding, member.email) ?? 'groom'}
                    disabled={busy}
                    onChange={(event) => {
                      if (!app.onSetMemberRole) return
                      void run(
                        () => app.onSetMemberRole!(member.email, event.target.value as WeddingRoleId),
                        'התפקיד עודכן.',
                      )
                    }}
                  >
                    {WEDDING_ROLES.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {isOwner && member.role !== 'owner' && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  disabled={busy}
                  onClick={() => {
                    if (!app.onRemoveMember) return
                    void run(() => app.onRemoveMember!(member.email), 'השותף הוסר.')
                  }}
                >
                  הסרה
                </button>
              )}
            </li>
            )
          })}
        </ul>
        {status && <p className="hint">{status}</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <WeddingDateField date={app.weddingDate} onSave={app.onSetWeddingDate} />
      {isCoupleOrOwner(wedding, app.user.email) && (
        <>
          <PaletteEditor palette={app.palette} onSave={app.onSetPalette} />
          <FamilyPlacesEditor places={app.familyPlaces} onSave={app.onSetFamilyPlaces} />
          <VenueQuestionsEditor questions={app.venueQuestions} onSave={app.onSetVenueQuestions} />
        </>
      )}
      <BuildStamp />
    </section>
  )
}

function PaletteEditor({
  palette,
  onSave,
}: {
  palette: PaletteChoice | null
  onSave: ((palette: PaletteChoice | null) => Promise<void>) | null
}) {
  const choice = palette ?? DEFAULT_PALETTE
  const { busy, error, run } = useAction()
  const preview = derivePalette(choice)

  async function save(next: PaletteChoice | null) {
    if (!onSave) return
    await run(async () => {
      await onSave(next)
    })
  }

  return (
    <form className="panel stack-form" onSubmit={(event) => event.preventDefault()}>
      <h2>פלטת צבעים</h2>
      <p>בחרו ירוק וורוד. שאר הגוונים באפליקציה נגזרים מהם.</p>
      <div className="palette-row">
        <label className="field">
          <span>ירוק</span>
          <input type="color" value={choice.green} disabled={busy || !onSave} onChange={(event) => void save({ ...choice, green: event.target.value })} />
        </label>
        <label className="field">
          <span>ורוד</span>
          <input type="color" value={choice.pink} disabled={busy || !onSave} onChange={(event) => void save({ ...choice, pink: event.target.value })} />
        </label>
      </div>
      <div className="palette-swatches" aria-hidden="true">
        {['--accent', '--accent-soft', '--gold', '--blush', '--ink', '--bg'].map((key) => (
          <span key={key} style={{ background: preview[key] }} />
        ))}
      </div>
      {palette && (
        <button type="button" className="btn btn-ghost" disabled={busy || !onSave} onClick={() => void save(null)}>
          חזרה לצבעים המקוריים
        </button>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  )
}

function FamilyPlacesEditor({
  places,
  onSave,
}: {
  places: readonly FamilyPlace[]
  onSave: ((places: FamilyPlace[]) => Promise<void>) | null
}) {
  const [name, setName] = useState('')
  const { busy, error, setError, run } = useAction()

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!onSave) return
    await run(async () => {
      const found = await geocodeInIsrael(name)
      if (!found) {
        setError('לא מצאנו את העיר. נסו שם כמו קרית גת.')
        return
      }
      const label = found.name || name.trim()
      if (places.some((place) => place.name === label)) {
        setError('העיר כבר ברשימה.')
        return
      }
      const next = normalizeFamilyPlaces([
        ...places,
        { id: `p_${crypto.randomUUID()}`, name: label, lat: found.lat, lng: found.lng },
      ])
      await onSave(next)
      setName('')
    })
  }

  async function remove(id: string) {
    if (!onSave) return
    await run(async () => {
      await onSave(places.filter((place) => place.id !== id))
    })
  }

  return (
    <form className="panel stack-form" onSubmit={(event) => void add(event)}>
      <h2>מקום מגורי משפחות</h2>
      <p>סמנו ערים שהמשפחה מגיעה מהן. במפת האולמות הן יופיעו כנקודות כובד, עם המרחק מכל אולם.</p>
      {places.length > 0 && (
        <ul className="place-list">
          {places.map((place) => (
            <li key={place.id}>
              <span>{place.name}</span>
              <button type="button" className="btn btn-ghost btn-small" disabled={busy || !onSave} onClick={() => void remove(place.id)}>
                הסרה
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="field">
        <span>עיר</span>
        <input value={name} placeholder="למשל קרית גת" onChange={(event) => setName(event.target.value)} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy || !onSave || !name.trim() || places.length >= 12}>
        {busy ? 'שומר…' : 'הוספת עיר'}
      </button>
    </form>
  )
}

function VenueQuestionsEditor({
  questions,
  onSave,
}: {
  questions: readonly VenueQuestion[]
  onSave: ((questions: VenueQuestion[]) => Promise<void>) | null
}) {
  const [draft, setDraft] = useState<VenueQuestion[]>(() => questions.map((question) => ({ ...question })))
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => setDraft(questions.map((question) => ({ ...question }))), [questions])
  if (!onSave && questions.length === 0) return null

  function update(id: string, patch: Partial<VenueQuestion>) {
    setDraft((current) => current.map((question) => (question.id === id ? { ...question, ...patch } : question)))
  }

  function move(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  return (
    <form
      className="panel stack-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!onSave) return
        setBusy(true)
        setError(null)
        setStatus(null)
        try {
          const next = normalizeVenueQuestions(draft)
          void onSave(next)
            .then(() => setStatus('שאלות האולמות נשמרו.'))
            .catch((failure: unknown) => setError(messageFrom(failure)))
            .finally(() => setBusy(false))
        } catch (failure) {
          setError(messageFrom(failure))
          setBusy(false)
        }
      }}
    >
      <h2>שאלות לאולמות</h2>
      <p>השאלות האלה מופיעות בכל אולם. מחיר לראש הוא הבסיס והתוספות, ואחריהם אחוזים. מס אולם מתחלק לפי כמות האורחים.</p>
      {draft.length === 0 && <p className="hint">עדיין אין שאלות.</p>}
      <ul className="question-editor">
        {draft.map((question, index) => (
          <li key={question.id}>
            <label className="field grow">
              <span className="visually-hidden">ניסוח השאלה</span>
              <input
                value={question.label}
                disabled={!onSave}
                onChange={(event) => update(question.id, { label: event.target.value })}
                placeholder="למשל: יש חניה?"
              />
            </label>
            <label className="field">
              <span className="visually-hidden">סוג השאלה</span>
              <select
                value={question.type}
                disabled={!onSave}
                onChange={(event) => update(question.id, { type: event.target.value as VenueQuestionType, pricePart: undefined })}
              >
                {VENUE_QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>{VENUE_QUESTION_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
            {question.type === 'number' && (
              <label className="field">
                <span className="visually-hidden">חלק בחישוב המחיר</span>
                <select
                  value={question.pricePart ?? ''}
                  disabled={!onSave}
                  onChange={(event) => update(question.id, { pricePart: event.target.value === '' ? undefined : event.target.value as PricePart })}
                >
                  <option value="">לפי שם השאלה{inferredPricePart(question.label) ? ` · ${PRICE_PART_LABELS[inferredPricePart(question.label)!]}` : ''}</option>
                  {PRICE_PARTS.map((part) => (
                    <option key={part} value={part}>{PRICE_PART_LABELS[part]}</option>
                  ))}
                </select>
              </label>
            )}
            {onSave && (
              <div className="question-actions">
                <button type="button" className="btn btn-ghost btn-small" disabled={index === 0} onClick={() => move(index, -1)} aria-label="הזזה למעלה">↑</button>
                <button type="button" className="btn btn-ghost btn-small" disabled={index === draft.length - 1} onClick={() => move(index, 1)} aria-label="הזזה למטה">↓</button>
                <button type="button" className="btn btn-danger btn-small" onClick={() => setDraft((current) => current.filter((item) => item.id !== question.id))}>
                  מחיקה
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {onSave && (
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" disabled={busy || draft.length >= 20} onClick={() => setDraft((current) => [...current, createVenueQuestion()])}>
            הוספת שאלה
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'שומר…' : 'שמירת שאלות'}</button>
        </div>
      )}
      {status && <p className="hint">{status}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  )
}

function WeddingDateField({ date, onSave }: { date: string; onSave: ((value: string) => Promise<void>) | null }) {
  const [value, setValue] = useState(date)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setValue(date), [date])
  if (!onSave && !date) return null
  return (
    <form
      className="panel stack-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!onSave) return
        setError(null)
        void onSave(value).catch((failure: unknown) => setError(messageFrom(failure)))
      }}
    >
      <label className="field">
        <span>תאריך החתונה</span>
        <input type="date" value={value} onChange={(event) => setValue(event.target.value)} disabled={!onSave} />
      </label>
      {onSave && <button type="submit" className="btn btn-primary">שמירת תאריך</button>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  )
}

function BuildStamp() {
  return <p className="build-id">גרסה: {__BUILD_ID__}</p>
}

function WeddingNameForm({
  initialName,
  isOwner,
  busy,
  onSave,
}: {
  initialName: string
  isOwner: boolean
  busy: boolean
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(initialName)

  return (
    <form
      className="panel stack-form"
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        if (!isOwner) return
        onSave(name)
      }}
    >
      <label className="field">
        <span>שם החתונה</span>
        <input value={name} onChange={(event) => setName(event.target.value)} disabled={!isOwner || busy} />
      </label>
      {isOwner && (
        <button type="submit" className="btn btn-primary" disabled={busy}>
          שמירת שם
        </button>
      )}
    </form>
  )
}

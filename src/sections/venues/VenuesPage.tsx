import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppServices } from '../../app/useAppServices.ts'
import {
  canManageVenues,
  compareVenues,
  normalizeTikTokUrl,
  normalizeVenue,
  tiktokAppSearchUrl,
  tiktokVideoId,
  tiktokWebVideoSearchUrl,
  VENUE_STATUSES,
  venueStatusLabel,
  venueVideoQuery,
  type Venue,
  type VenueDraft,
  type VenueStatusId,
} from '../../domain/venues.ts'
import { formatPortionPrice, portionQuote } from '../../domain/venuePrice.ts'
import { mergeAnswers, type VenueQuestion } from '../../domain/venueQuestions.ts'
import { compressImageFile } from '../../ui/compressImage.ts'
import { Fab } from '../../ui/Fab.tsx'
import { OverflowMenu } from '../../ui/OverflowMenu.tsx'
import { messageFrom } from '../../ui/messageFrom.ts'
import { Dialog } from '../../ui/Dialog.tsx'

export function VenuesPage() {
  const app = useAppServices()
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<VenueStatusId | 'all'>('all')
  const [editing, setEditing] = useState<Venue | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Venue | null>(null)
  const manage = canManageVenues(app.wedding, app.user?.email ?? null)

  useEffect(() => {
    return app.venues.subscribe(
      (next) => {
        setVenues(next)
        setLoadError(null)
      },
      (failure) => setLoadError(messageFrom(failure)),
    )
  }, [app.venues])

  const visible = useMemo(
    () => (venues ?? []).filter((venue) => status === 'all' || venue.status === status).sort(compareVenues),
    [venues, status],
  )
  const counts = useMemo(() => {
    const next = new Map<VenueStatusId | 'all', number>([['all', venues?.length ?? 0]])
    for (const item of VENUE_STATUSES) next.set(item.id, 0)
    for (const venue of venues ?? []) next.set(venue.status, (next.get(venue.status) ?? 0) + 1)
    return next
  }, [venues])

  async function save(draft: VenueDraft) {
    setSaving(true)
    setError(null)
    try {
      if (editing && editing !== 'new') await app.venues.update(editing.id, draft)
      else await app.venues.create(draft, app.user?.email ?? '')
      setEditing(null)
    } catch (failure) {
      setError(messageFrom(failure))
      throw failure
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(venue: Venue, next: VenueStatusId) {
    setPicking(null)
    if (next === venue.status) return
    setError(null)
    try {
      await app.venues.update(venue.id, { ...venue, status: next })
    } catch (failure) {
      setError(messageFrom(failure))
    }
  }

  async function remove(venue: Venue) {
    setError(null)
    try {
      await app.venues.remove(venue.id)
    } catch (failure) {
      setError(messageFrom(failure))
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>אולמות</h1>
        </div>
      </header>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {error && !editing && <p className="form-error" role="alert">{error}</p>}
      {!manage && <p className="hint">צפייה בלבד. הוספה ועריכה שמורות לחתן, לכלה ולבעלים.</p>}
      {venues === null ? (
        <p className="hint">טוען אולמות…</p>
      ) : (
        <>
          <div className="chip-row" role="tablist" aria-label="סינון לפי סטטוס">
            <FilterChip active={status === 'all'} count={counts.get('all') ?? 0} onClick={() => setStatus('all')}>הכל</FilterChip>
            {VENUE_STATUSES.map((item) => (
              <FilterChip key={item.id} active={status === item.id} count={counts.get(item.id) ?? 0} onClick={() => setStatus(item.id)}>
                {item.label}
              </FilterChip>
            ))}
          </div>
          {venues.length === 0 ? (
            <div className="empty">
              <h2>עדיין אין אולמות</h2>
              <p>הוסיפו את המקום הראשון שתרצו לבקר.</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <h2>אין אולמות בסטטוס הזה</h2>
            </div>
          ) : (
            <ul className="venue-list">
              {visible.map((venue) => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  questions={app.venueQuestions}
                  manage={manage}
                  picking={picking === venue.id}
                  onToggleStatus={() => setPicking((current) => current === venue.id ? null : venue.id)}
                  onStatus={(next) => void changeStatus(venue, next)}
                  onEdit={() => setEditing(venue)}
                  onDelete={() => setDeleting(venue)}
                  onSaveAnswers={async (answers) => {
                    await app.venues.update(venue.id, { ...venue, answers: mergeAnswers(venue.answers, app.venueQuestions, answers) })
                  }}
                />
              ))}
            </ul>
          )}
        </>
      )}
      {manage && <Fab label="הוספת אולם" onClick={() => setEditing('new')} />}
      <Dialog open={deleting !== null} title="מחיקת אולם" onClose={() => setDeleting(null)}>
        {deleting && (
          <div className="stack-form">
            <p>למחוק את {deleting.name}?</p>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleting(null)}>ביטול</button>
              <button type="button" className="btn btn-danger" onClick={() => { void remove(deleting); setDeleting(null) }}>מחיקה</button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog open={editing !== null} title={editing && editing !== 'new' ? 'עריכת אולם' : 'הוספת אולם'} onClose={() => setEditing(null)}>
        {editing && (
          <VenueForm
            key={editing === 'new' ? 'new' : editing.id}
            venue={editing === 'new' ? null : editing}
            questions={app.venueQuestions}
            saving={saving}
            onCancel={() => setEditing(null)}
            onSubmit={save}
          />
        )}
      </Dialog>
    </section>
  )
}

function VenueCard({
  venue,
  questions,
  manage,
  picking,
  onToggleStatus,
  onStatus,
  onEdit,
  onDelete,
  onSaveAnswers,
}: {
  venue: Venue
  questions: readonly VenueQuestion[]
  manage: boolean
  picking: boolean
  onToggleStatus: () => void
  onStatus: (status: VenueStatusId) => void
  onEdit: () => void
  onDelete: () => void
  onSaveAnswers: (answers: Record<string, string>) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const quote = portionQuote(questions, venue.answers)

  function toggle() {
    setOpen((current) => {
      const next = !current
      if (next) {
        const seeded: Record<string, string> = {}
        for (const question of questions) seeded[question.id] = venue.answers[question.id] ?? ''
        setAnswers(seeded)
        setError(null)
      }
      return next
    })
  }

  async function saveAnswers() {
    setSaving(true)
    setError(null)
    try {
      await onSaveAnswers(answers)
    } catch (failure) {
      setError(messageFrom(failure))
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className={`venue-card venue-row venue-${venue.status}`}>
      <div className={`venue-photo venue-cover-${venue.status}`}>
        {venue.imageUrl ? (
          <img src={venue.imageUrl} alt="" />
        ) : (
          <span>{venue.name.trim().slice(0, 1) || 'א'}</span>
        )}
      </div>
      <div className="venue-body">
        <div className="venue-title-row">
          <button type="button" className="venue-open" aria-expanded={open} onClick={toggle}>
            <h2 className={venue.status === 'rejected' ? 'is-struck' : undefined}>{venue.name}</h2>
            {venue.city && <p className="venue-city">{venue.city}</p>}
          </button>
          <button type="button" className="icon-btn" aria-label={`טיקטוק של ${venue.name}`} onClick={() => openTikTokVideos(venue.name, venue.city)}>
            <TikTokIcon />
          </button>
          {manage && (
            <OverflowMenu label={`פעולות עבור ${venue.name}`}>
              <button type="button" role="menuitem" onClick={onEdit}>עריכה</button>
              <button type="button" role="menuitem" className="menu-danger" onClick={onDelete}>מחיקה</button>
            </OverflowMenu>
          )}
        </div>
        <div className="status-wrap">
          <button
            type="button"
            className={`status-chip status-${venue.status}`}
            disabled={!manage}
            aria-expanded={picking}
            onClick={onToggleStatus}
          >
            {venue.status === 'chosen' ? '♥ ' : ''}
            {venueStatusLabel(venue.status)}
            {venue.status === 'scheduled' && venue.visitDate ? ` · ${formatVisit(venue.visitDate)}` : ''}
          </button>
          {picking && (
            <div className="status-picker" role="listbox">
              {VENUE_STATUSES.map((item) => (
                <button key={item.id} type="button" role="option" aria-selected={item.id === venue.status} onClick={() => onStatus(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {open ? (
          <div className="venue-questions">
            {questions.length === 0 ? (
              <p className="hint">אין עדיין שאלות. אפשר להוסיף אותן בהגדרות.</p>
            ) : questions.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                value={answers[question.id] ?? ''}
                disabled={!manage}
                onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
              />
            ))}
            {manage && questions.length > 0 && (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveAnswers()}>
                {saving ? 'שומר…' : 'שמירת תשובות'}
              </button>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <VenueVideos urls={venue.tiktokUrls} />
          </div>
        ) : (
          <button type="button" className="venue-summary" onClick={toggle}>
            <strong>{quote ? formatPortionPrice(quote.amount) : 'אין מחיר למנה'}</strong>
            {quote?.adjusted && <span>אחרי כל החישובים</span>}
          </button>
        )}
      </div>
    </li>
  )
}

function openTikTokVideos(name: string, city: string) {
  const query = venueVideoQuery(name, city)
  const web = tiktokWebVideoSearchUrl(query)
  let left = false
  const markLeft = () => {
    if (document.hidden) left = true
  }
  document.addEventListener('visibilitychange', markLeft)
  window.location.href = tiktokAppSearchUrl(query)
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', markLeft)
    if (left || document.hidden) return
    const tab = window.open(web, '_blank', 'noopener')
    if (!tab) window.location.assign(web)
  }, 1500)
}

function VenueVideos({ urls }: { urls: readonly string[] }) {
  if (urls.length === 0) return null
  return (
    <details className="venue-videos">
      <summary>סרטונים ({urls.length})</summary>
      <div className="tiktok-list">
        {urls.map((url) => {
          const id = tiktokVideoId(url)
          return id ? (
            <iframe
              key={url}
              className="tiktok-frame"
              src={`https://www.tiktok.com/embed/v2/${id}`}
              title="סרטון טיקטוק"
              loading="lazy"
              allow="fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">{url}</a>
          )
        })}
      </div>
    </details>
  )
}

function FilterChip({ active, count, onClick, children }: { active: boolean; count: number; onClick: () => void; children: string }) {
  return (
    <button type="button" className={active ? 'chip chip-on' : 'chip'} aria-pressed={active} onClick={onClick}>
      {children}<span>{count}</span>
    </button>
  )
}

function QuestionField({ question, value, onChange, disabled = false }: { question: VenueQuestion; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  if (question.type === 'yesno') {
    return (
      <div className="field">
        <span>{question.label}</span>
        <div className="segment" role="group" aria-label={question.label}>
          <button type="button" className={value === 'yes' ? 'segment-on' : undefined} disabled={disabled} onClick={() => onChange(value === 'yes' ? '' : 'yes')}>כן</button>
          <button type="button" className={value === 'no' ? 'segment-on' : undefined} disabled={disabled} onClick={() => onChange(value === 'no' ? '' : 'no')}>לא</button>
        </div>
      </div>
    )
  }
  if (question.type === 'long') {
    return (
      <label className="field">
        <span>{question.label}</span>
        <textarea value={value} rows={3} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </label>
    )
  }
  return (
    <label className="field">
      <span>{question.label}</span>
      <input
        value={value}
        disabled={disabled}
        inputMode={question.type === 'number' ? 'decimal' : 'text'}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function formatVisit(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
}

function TikTokIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4c.4 2.4 1.8 4 4 4.4v2.2c-1.4 0-2.7-.4-4-1.2v6.2a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.4a3.2 3.2 0 1 0 2.3 3.1V4z" fill="currentColor" /></svg>
}

function VenueForm({
  venue,
  questions,
  saving,
  onCancel,
  onSubmit,
}: {
  venue: Venue | null
  questions: readonly VenueQuestion[]
  saving: boolean
  onCancel: () => void
  onSubmit: (draft: VenueDraft) => Promise<void>
}) {
  const [name, setName] = useState(venue?.name ?? '')
  const [city, setCity] = useState(venue?.city ?? '')
  const [phone, setPhone] = useState(venue?.phone ?? '')
  const [website, setWebsite] = useState(venue?.website ?? '')
  const [priceNotes, setPriceNotes] = useState(venue?.priceNotes ?? '')
  const [status, setStatus] = useState<VenueStatusId>(venue?.status ?? 'want')
  const [visitDate, setVisitDate] = useState(venue?.visitDate ?? '')
  const [notes, setNotes] = useState(venue?.notes ?? '')
  const [imageUrl, setImageUrl] = useState(venue?.imageUrl ?? '')
  const [tiktokUrls, setTiktokUrls] = useState<string[]>(venue?.tiktokUrls ?? [])
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {}
    for (const question of questions) next[question.id] = venue?.answers[question.id] ?? ''
    return next
  })
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  function addVideo() {
    try {
      const url = normalizeTikTokUrl(videoUrl)
      setTiktokUrls((current) => (current.includes(url) ? current : [...current, url]))
      setVideoUrl('')
      setError(null)
    } catch (failure) {
      setError(messageFrom(failure))
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      const draft = normalizeVenue({
        name,
        city,
        phone,
        website,
        priceNotes,
        status,
        visitDate,
        notes,
        tiktokUrls,
        answers: mergeAnswers(venue?.answers ?? {}, questions, answers),
        imageUrl,
      })
      await onSubmit(draft)
    } catch (failure) {
      setError(messageFrom(failure))
    }
  }

  return (
    <form className="stack-form" onSubmit={(event) => void handleSubmit(event)}>
      <label className="field">
        <span>תמונה</span>
        {imageUrl && <img className="venue-form-photo" src={imageUrl} alt="" />}
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void compressImageFile(file).then(setImageUrl).catch(() => setError('לא הצלחנו לקרוא את התמונה.'))
          }}
        />
        {imageUrl && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setImageUrl('')}>הסרת תמונה</button>
        )}
      </label>
      <label className="field">
        <span>שם האולם</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="field">
        <span>עיר או אזור</span>
        <input value={city} onChange={(event) => setCity(event.target.value)} />
      </label>
      <label className="field">
        <span>טלפון</span>
        <input value={phone} onChange={(event) => setPhone(event.target.value)} dir="ltr" className="ltr-field" inputMode="tel" />
      </label>
      <label className="field">
        <span>אתר</span>
        <input value={website} onChange={(event) => setWebsite(event.target.value)} dir="ltr" className="ltr-field" inputMode="url" placeholder="https://" />
      </label>
      <label className="field">
        <span>הערות מחיר</span>
        <input value={priceNotes} onChange={(event) => setPriceNotes(event.target.value)} />
      </label>
      <label className="field">
        <span>סטטוס</span>
        <select value={status} onChange={(event) => setStatus(event.target.value as VenueStatusId)}>
          {VENUE_STATUSES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>תאריך ביקור</span>
        <input type="date" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} />
      </label>
      <label className="field">
        <span>הערות</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </label>
      {questions.map((question) => (
        <QuestionField
          key={question.id}
          question={question}
          value={answers[question.id] ?? ''}
          onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
        />
      ))}
      <div className="field">
        <span>סרטוני טיקטוק</span>
        <div className="member-add">
          <input
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            dir="ltr"
            className="ltr-field"
            placeholder="https://www.tiktok.com/@user/video/123"
          />
          <button type="button" className="btn btn-ghost" onClick={addVideo}>הוספה</button>
        </div>
        <ul className="contact-list">
          {tiktokUrls.map((url) => (
            <li key={url} className="contact-row">
              <span className="ltr-inline" dir="ltr">{url}</span>
              <button type="button" className="btn btn-danger btn-small" onClick={() => setTiktokUrls((current) => current.filter((item) => item !== url))}>
                הסרה
              </button>
            </li>
          ))}
        </ul>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>ביטול</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'שומר…' : 'שמירה'}</button>
      </div>
    </form>
  )
}

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppServices } from '../../app/useAppServices.ts'
import {
  canManageVenues,
  mapsSearchUrl,
  normalizeTikTokUrl,
  normalizeVenue,
  tiktokSearchUrl,
  tiktokVideoId,
  VENUE_STATUSES,
  venueStatusLabel,
  type Venue,
  type VenueDraft,
  type VenueStatusId,
} from '../../domain/venues.ts'
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

  const visible = (venues ?? []).filter((venue) => status === 'all' || venue.status === status)

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
          <p>אולמות לביקור. סרטונים נפתחים מטיקטוק, בלי חיבור לשרת.</p>
        </div>
        {manage && (
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            הוספת אולם
          </button>
        )}
      </header>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {error && !editing && <p className="form-error" role="alert">{error}</p>}
      {!manage && <p className="hint">צפייה בלבד. הוספה ועריכה שמורות לחתן, לכלה ולבעלים.</p>}
      {venues === null ? (
        <p className="hint">טוען אולמות…</p>
      ) : (
        <>
          <label className="field">
            <span>סטטוס</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as VenueStatusId | 'all')}>
              <option value="all">הכל</option>
              {VENUE_STATUSES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          {venues.length === 0 ? (
            <div className="empty">
              <h2>עדיין אין אולמות</h2>
            </div>
          ) : (
            <ul className="song-list">
              {visible.map((venue) => (
                <li key={venue.id} className="song-card venue-card">
                  <div>
                    <strong>{venue.name}</strong>
                    <span className="badge badge-side">{venueStatusLabel(venue.status)}</span>
                    {venue.city && <span className="cell-note">{venue.city}</span>}
                    {venue.phone && <span className="cell-note ltr-inline" dir="ltr">{venue.phone}</span>}
                    {venue.priceNotes && <span className="cell-note">{venue.priceNotes}</span>}
                    {venue.visitDate && <span className="cell-note">ביקור: {venue.visitDate}</span>}
                    {venue.notes && <span className="cell-note">{venue.notes}</span>}
                    <div className="row-actions">
                      <a className="btn btn-primary btn-small" href={tiktokSearchUrl(venue.name, venue.city)} target="_blank" rel="noopener noreferrer">
                        סרטונים בטיקטוק
                      </a>
                      <a className="btn btn-ghost btn-small" href={mapsSearchUrl(venue.name, venue.city)} target="_blank" rel="noopener noreferrer">
                        מפה
                      </a>
                      {venue.website && (
                        <a className="btn btn-ghost btn-small" href={venue.website} target="_blank" rel="noopener noreferrer">
                          אתר
                        </a>
                      )}
                    </div>
                    <VenueVideos urls={venue.tiktokUrls} />
                  </div>
                  {manage && (
                    <div className="row-actions">
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(venue)}>עריכה</button>
                      <button type="button" className="btn btn-danger btn-small" onClick={() => void remove(venue)}>מחיקה</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Dialog open={editing !== null} title={editing && editing !== 'new' ? 'עריכת אולם' : 'הוספת אולם'} onClose={() => setEditing(null)}>
        {editing && (
          <VenueForm
            key={editing === 'new' ? 'new' : editing.id}
            venue={editing === 'new' ? null : editing}
            saving={saving}
            onCancel={() => setEditing(null)}
            onSubmit={save}
          />
        )}
      </Dialog>
    </section>
  )
}

function VenueVideos({ urls }: { urls: readonly string[] }) {
  if (urls.length === 0) return null
  return (
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
          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </a>
        )
      })}
    </div>
  )
}

function VenueForm({
  venue,
  saving,
  onCancel,
  onSubmit,
}: {
  venue: Venue | null
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
  const [tiktokUrls, setTiktokUrls] = useState<string[]>(venue?.tiktokUrls ?? [])
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
      })
      await onSubmit(draft)
    } catch (failure) {
      setError(messageFrom(failure))
    }
  }

  return (
    <form className="stack-form" onSubmit={(event) => void handleSubmit(event)}>
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

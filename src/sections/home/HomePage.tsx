import { useEffect, useMemo, useState } from 'react'
import { useAppServices } from '../../app/useAppServices.ts'
import { countdownLabel, describeActivity, groupActivityByDay, relativeTime, type ActivityEvent } from '../../domain/activity.ts'
import { summarizeGuests } from '../../domain/stats.ts'
import { sideForRole } from '../../domain/roles.ts'
import { messageFrom } from '../../ui/messageFrom.ts'
import { markActivitySeen } from './seen.ts'

export function HomePage() {
  const app = useAppServices()
  const [events, setEvents] = useState<ActivityEvent[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [guests, setGuests] = useState(0)
  const [confirmed, setConfirmed] = useState(0)
  const [pending, setPending] = useState(0)
  const [declined, setDeclined] = useState(0)
  const [songs, setSongs] = useState(0)
  const [venues, setVenues] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => app.activity.subscribe((page) => {
    setEvents(page.events)
    setHasMore(page.hasMore)
    setError(null)
  }, (failure) => setError(messageFrom(failure))), [app.activity])

  useEffect(() => app.guests.subscribe((next) => {
    const stats = summarizeGuests(next)
    setGuests(stats.overall.people)
    setConfirmed(stats.overall.attending)
    setPending(stats.overall.pending)
    setDeclined(stats.overall.declined)
  }), [app.guests])
  useEffect(() => app.songs.subscribe((next) => setSongs(next.length)), [app.songs])
  useEffect(() => app.venues.subscribe((next) => setVenues(next.length)), [app.venues])

  useEffect(() => {
    const newest = events?.[0]?.createdAt
    if (!newest) return
    markActivitySeen(app.wedding?.id ?? 'local', app.user?.email ?? 'local', newest)
  }, [app.user?.email, app.wedding?.id, events])

  const groups = useMemo(() => groupActivityByDay(events ?? []), [events])
  const countdown = countdownLabel(app.weddingDate)

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>עדכונים</h1>
          <p>מה השתנה בחתונה, בזמן אמת.</p>
        </div>
      </header>
      <div className="stats home-stats">
        <article className="stat-card"><p className="stat-label">מוזמנים</p><p className="stat-value">{guests}</p></article>
        <article className="stat-card stat-attending"><p className="stat-label">מגיעים</p><p className="stat-value">{confirmed}</p></article>
        <article className="stat-card stat-pending"><p className="stat-label">ממתינים</p><p className="stat-value">{pending}</p></article>
        <article className="stat-card stat-declined"><p className="stat-label">לא מגיעים</p><p className="stat-value">{declined}</p></article>
        <article className="stat-card"><p className="stat-label">שירים</p><p className="stat-value">{songs}</p></article>
        <article className="stat-card"><p className="stat-label">אולמות</p><p className="stat-value">{venues}</p></article>
        {countdown && <article className="stat-card stat-maybe"><p className="stat-label">החתונה</p><p className="stat-value countdown">{countdown}</p></article>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {events === null ? (
        <p className="hint">טוען את העדכונים…</p>
      ) : events.length === 0 ? (
        <div className="empty">
          <h2>עדיין אין עדכונים</h2>
          <p>כשמישהו מוסיף מוזמן, שיר או אולם, זה יופיע כאן.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="feed-day">
            <h2>{group.label}</h2>
            <ul className="feed-list">
              {group.events.map((event) => (
                <li key={event.id} className="feed-card">
                  <Avatar name={event.actorName} photoUrl={event.actorPhotoUrl} role={event.actorRole} />
                  <div className="feed-body">
                    <p>{describeActivity(event)}</p>
                    <p className="feed-meta">
                      <FeedIcon type={event.type} />
                      <time dateTime={event.createdAt}>{relativeTime(event.createdAt)}</time>
                    </p>
                  </div>
                  {event.details.artworkUrl && (event.type === 'song_added' || event.type === 'song_deleted') && (
                    <img className="song-art" src={event.details.artworkUrl} alt="" width={60} height={60} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {hasMore && (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={loadingMore}
          onClick={() => {
            setLoadingMore(true)
            void app.activity.loadMore().finally(() => setLoadingMore(false))
          }}
        >
          {loadingMore ? 'טוען…' : 'עוד עדכונים'}
        </button>
      )}
    </section>
  )
}

function Avatar({ name, photoUrl, role }: { name: string; photoUrl: string; role: ActivityEvent['actorRole'] }) {
  const initials = name.trim().includes('@')
    ? (name.split('@')[0]?.slice(0, 1) ?? '?')
    : name.trim().split(/\s+/).slice(0, 2).map((part) => part.slice(0, 1)).join('')
  const tone = role && sideForRole(role) === 'bride' ? 'bride' : 'groom'
  if (photoUrl) return <img className="avatar" src={photoUrl} alt="" />
  return <span className={`avatar avatar-${tone}`} aria-hidden="true">{initials || '?'}</span>
}

function FeedIcon({ type }: { type: ActivityEvent['type'] }) {
  const label = type.startsWith('song') ? 'שיר' : type.startsWith('venue') ? 'אולם' : type.startsWith('member') || type === 'role_changed' ? 'שותף' : 'מוזמן'
  return <span className={`feed-icon feed-icon-${type.split('_')[0]}`} aria-label={label}>{iconFor(type)}</span>
}

function iconFor(type: ActivityEvent['type']): string {
  if (type.startsWith('song')) return '♪'
  if (type.startsWith('venue')) return '⌂'
  if (type === 'member_added' || type === 'role_changed') return '☺'
  if (type === 'rsvp_changed') return '✓'
  if (type === 'guests_imported') return '↓'
  if (type.endsWith('deleted')) return '×'
  return '+'
}

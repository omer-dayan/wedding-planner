import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppServices } from '../../app/useAppServices.ts'
import { assignedRole, roleLabel } from '../../domain/roles.ts'
import {
  canEditSong,
  momentLabel,
  normalizeSong,
  SONG_MOMENTS,
  type Song,
  type SongDraft,
  type SongMomentId,
} from '../../domain/songs.ts'
import { messageFrom } from '../../ui/messageFrom.ts'
import { Dialog } from '../../ui/Dialog.tsx'

type MomentFilter = SongMomentId | 'all' | 'none'

export function MusicPage() {
  const app = useAppServices()
  const [songs, setSongs] = useState<Song[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [moment, setMoment] = useState<MomentFilter>('all')
  const [editing, setEditing] = useState<Song | null | 'new'>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return app.songs.subscribe(
      (next) => {
        setSongs(next)
        setLoadError(null)
      },
      (failure) => setLoadError(messageFrom(failure)),
    )
  }, [app.songs])

  const visible = useMemo(() => filterSongs(songs ?? [], search, moment), [songs, search, moment])
  const groups = useMemo(() => groupSongs(visible, moment), [visible, moment])

  async function save(draft: SongDraft) {
    setSaving(true)
    setError(null)
    try {
      if (editing && editing !== 'new') await app.songs.update(editing.id, draft)
      else {
        await app.songs.create(draft, {
          email: app.user?.email ?? '',
          name: app.user?.displayName || 'מכשיר זה',
          role: app.user ? assignedRole(app.wedding, app.user.email) : null,
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

  async function remove(song: Song) {
    setError(null)
    try {
      await app.songs.remove(song.id)
      setEditing(null)
    } catch (failure) {
      setError(messageFrom(failure))
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>מוזיקה</h1>
          <p>שירים שתרצו שינגנו בחתונה.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          הוספת שיר
        </button>
      </header>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {error && !editing && <p className="form-error" role="alert">{error}</p>}
      {songs === null ? (
        <p className="hint">טוען את השירים…</p>
      ) : (
        <>
          <div className="toolbar">
            <label className="field grow">
              <span>חיפוש</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="שם שיר, אמן או הערה" />
            </label>
            <label className="field">
              <span>רגע</span>
              <select value={moment} onChange={(event) => setMoment(event.target.value as MomentFilter)}>
                <option value="all">הכל</option>
                <option value="none">ללא רגע</option>
                {SONG_MOMENTS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>
          {songs.length === 0 ? (
            <div className="empty">
              <h2>עדיין אין שירים</h2>
              <p>כל מי ששותף לחתונה יכול להוסיף שיר.</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <h2>אין שירים שתואמים לחיפוש</h2>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.id} className="song-group">
                <h2>{group.label}</h2>
                <ul className="song-list">
                  {group.songs.map((song) => (
                    <li key={song.id} className="song-card">
                      <div>
                        <strong>{song.title}</strong>
                        {song.artist && <span className="cell-note">{song.artist}</span>}
                        {song.notes && <span className="cell-note">{song.notes}</span>}
                        <p className="song-by">
                          {song.addedByName || 'לא ידוע'}
                          {song.addedByRole ? ` · ${roleLabel(song.addedByRole)}` : ''}
                        </p>
                        {song.url && (
                          <a className="text-button" href={song.url} target="_blank" rel="noopener noreferrer">
                            לפתוח את הקישור
                          </a>
                        )}
                      </div>
                      {canEditSong(app.wedding, app.user?.email ?? null, song) && (
                        <div className="row-actions">
                          <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(song)}>עריכה</button>
                          <button type="button" className="btn btn-danger btn-small" onClick={() => void remove(song)}>מחיקה</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
      <Dialog
        open={editing !== null}
        title={editing && editing !== 'new' ? 'עריכת שיר' : 'הוספת שיר'}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <SongForm
            key={editing === 'new' ? 'new' : editing.id}
            song={editing === 'new' ? null : editing}
            saving={saving}
            onCancel={() => setEditing(null)}
            onSubmit={save}
          />
        )}
      </Dialog>
    </section>
  )
}

function SongForm({
  song,
  saving,
  onCancel,
  onSubmit,
}: {
  song: Song | null
  saving: boolean
  onCancel: () => void
  onSubmit: (draft: SongDraft) => Promise<void>
}) {
  const [title, setTitle] = useState(song?.title ?? '')
  const [artist, setArtist] = useState(song?.artist ?? '')
  const [url, setUrl] = useState(song?.url ?? '')
  const [moment, setMoment] = useState<SongMomentId | ''>(song?.moment ?? '')
  const [notes, setNotes] = useState(song?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      const draft = normalizeSong({
        title,
        artist,
        url,
        moment: moment || null,
        notes,
      })
      await onSubmit(draft)
    } catch (failure) {
      setError(messageFrom(failure))
    }
  }

  return (
    <form className="stack-form" onSubmit={(event) => void handleSubmit(event)}>
      <label className="field">
        <span>שם השיר</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field">
        <span>אמן</span>
        <input value={artist} onChange={(event) => setArtist(event.target.value)} />
      </label>
      <label className="field">
        <span>קישור</span>
        <input value={url} onChange={(event) => setUrl(event.target.value)} dir="ltr" className="ltr-field" inputMode="url" placeholder="https://" />
      </label>
      <label className="field">
        <span>רגע</span>
        <select value={moment} onChange={(event) => setMoment(event.target.value as SongMomentId | '')}>
          <option value="">ללא רגע</option>
          {SONG_MOMENTS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
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

function filterSongs(songs: readonly Song[], search: string, moment: MomentFilter): Song[] {
  const needle = search.trim().toLocaleLowerCase('he')
  return songs.filter((song) => {
    if (moment === 'none' && song.moment !== null) return false
    if (moment !== 'all' && moment !== 'none' && song.moment !== moment) return false
    if (!needle) return true
    return `${song.title} ${song.artist} ${song.notes} ${song.addedByName}`.toLocaleLowerCase('he').includes(needle)
  })
}

function groupSongs(songs: readonly Song[], moment: MomentFilter): Array<{ id: string; label: string; songs: Song[] }> {
  const order: Array<SongMomentId | null> =
    moment === 'all' ? [...SONG_MOMENTS.map((item) => item.id), null] : [moment === 'none' ? null : moment]
  return order
    .map((id) => ({
      id: id ?? 'none',
      label: momentLabel(id),
      songs: songs
        .filter((song) => song.moment === id)
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title, 'he')),
    }))
    .filter((group) => group.songs.length > 0)
}

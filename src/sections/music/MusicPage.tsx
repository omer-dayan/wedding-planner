import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppServices } from '../../app/useAppServices.ts'
import { assignedRole, roleLabel } from '../../domain/roles.ts'
import { searchItunesSongs, type ItunesSong } from '../../domain/itunes.ts'
import {
  canEditSong,
  momentLabel,
  normalizeSong,
  sameSongTitleArtist,
  SONG_MOMENTS,
  spotifyHref,
  spotifyTrackId,
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
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)

  useEffect(() => {
    return app.songs.subscribe(
      (next) => {
        setSongs(next)
        setLoadError(null)
      },
      (failure) => setLoadError(messageFrom(failure)),
    )
  }, [app.songs])

  useEffect(() => {
    if (!toast) return
    const handle = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(handle)
  }, [toast])

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

  async function addFromSearch(draft: SongDraft) {
    setError(null)
    await app.songs.create(draft, {
      email: app.user?.email ?? '',
      name: app.user?.displayName || 'מכשיר זה',
      role: app.user ? assignedRole(app.wedding, app.user.email) : null,
    })
    setToast({ id: Date.now(), text: 'השיר נוסף לרשימה' })
  }

  async function updateMoment(song: Song, next: SongMomentId | null) {
    setError(null)
    await app.songs.update(song.id, {
      title: song.title,
      artist: song.artist,
      url: song.url,
      artworkUrl: song.artworkUrl,
      previewUrl: song.previewUrl,
      moment: next,
      notes: song.notes,
    })
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
      {toast && !editing && <p className="toast" role="status">{toast.text}</p>}
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
                      {song.artworkUrl && <img className="song-art" src={song.artworkUrl} alt="" width={60} height={60} />}
                      <div>
                        <strong>{song.title}</strong>
                        {song.artist && <span className="cell-note">{song.artist}</span>}
                        {song.notes && <span className="cell-note">{song.notes}</span>}
                        <p className="song-by">
                          {song.addedByName || 'לא ידוע'}
                          {song.addedByRole ? ` · ${roleLabel(song.addedByRole)}` : ''}
                        </p>
                        <div className="row-actions">
                          <a className="btn btn-spotify btn-small" href={spotifyHref(song.title, song.artist, song.url)} target="_blank" rel="noopener noreferrer">
                            Spotify
                          </a>
                          {song.url && !spotifyTrackId(song.url) && (
                            <a className="text-button" href={song.url} target="_blank" rel="noopener noreferrer">
                              לפתוח את הקישור
                            </a>
                          )}
                        </div>
                        {spotifyTrackId(song.url) && (
                          <iframe
                            className="spotify-embed"
                            title="Spotify"
                            src={`https://open.spotify.com/embed/track/${spotifyTrackId(song.url)}`}
                            height={80}
                            loading="lazy"
                          />
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
        onClose={() => {
          setEditing(null)
          setToast(null)
        }}
      >
        {editing && (
          <SongForm
            key={editing === 'new' ? 'new' : editing.id}
            song={editing === 'new' ? null : editing}
            songs={songs ?? []}
            saving={saving}
            toast={toast?.text ?? null}
            canEdit={(song) => canEditSong(app.wedding, app.user?.email ?? null, song)}
            onCancel={() => setEditing(null)}
            onSubmit={save}
            onQuickAdd={addFromSearch}
            onSetMoment={updateMoment}
          />
        )}
      </Dialog>
    </section>
  )
}

function SongForm({
  song,
  songs,
  saving,
  toast,
  canEdit,
  onCancel,
  onSubmit,
  onQuickAdd,
  onSetMoment,
}: {
  song: Song | null
  songs: readonly Song[]
  saving: boolean
  toast: string | null
  canEdit: (song: Song) => boolean
  onCancel: () => void
  onSubmit: (draft: SongDraft) => Promise<void>
  onQuickAdd: (draft: SongDraft) => Promise<void>
  onSetMoment: (song: Song, moment: SongMomentId | null) => Promise<void>
}) {
  const [title, setTitle] = useState(song?.title ?? '')
  const [artist, setArtist] = useState(song?.artist ?? '')
  const [artworkUrl] = useState(song?.artworkUrl ?? '')
  const [previewUrl] = useState(song?.previewUrl ?? '')
  const [url, setUrl] = useState(song?.url ?? '')
  const [moment, setMoment] = useState<SongMomentId | ''>(song?.moment ?? '')
  const [notes, setNotes] = useState(song?.notes ?? '')
  const [manual, setManual] = useState(song !== null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ItunesSong[]>([])
  const [searching, setSearching] = useState(false)
  const [playing, setPlaying] = useState<number | null>(null)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    const handle = window.setTimeout(() => {
      setSearching(true)
      void searchItunesSongs(term)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => window.clearTimeout(handle)
  }, [query])

  useEffect(() => () => {
    audio.current?.pause()
  }, [])

  function stopPreview() {
    audio.current?.pause()
    setPlaying(null)
  }

  function togglePreview(result: ItunesSong) {
    if (!result.previewUrl) return
    if (!audio.current) audio.current = new Audio()
    const player = audio.current
    if (playing === result.trackId) {
      player.pause()
      setPlaying(null)
      return
    }
    player.src = result.previewUrl
    void player.play()
    setPlaying(result.trackId)
    player.onended = () => setPlaying(null)
  }

  async function addResult(result: ItunesSong) {
    const listed = songs.find((item) => sameSongTitleArtist(item, { title: result.trackName, artist: result.artistName }))
    if (listed || addingId !== null) return
    stopPreview()
    setAddingId(result.trackId)
    setError(null)
    try {
      await onQuickAdd({
        title: result.trackName,
        artist: result.artistName,
        url: '',
        artworkUrl: result.artworkUrl100,
        previewUrl: result.previewUrl,
        moment: null,
        notes: '',
      })
    } catch (failure) {
      setError(messageFrom(failure))
    } finally {
      setAddingId(null)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!manual) return
    stopPreview()
    try {
      const draft = normalizeSong({
        title,
        artist,
        url,
        artworkUrl,
        previewUrl,
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
      {toast && <p className="toast" role="status">{toast}</p>}
      {!song && (
        <label className="field">
          <span>חיפוש שיר</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="שם שיר או אמן" enterKeyHint="search" />
        </label>
      )}
      {searching && <p className="hint">מחפשים…</p>}
      {results.length > 0 && (
        <ul className="itunes-list">
          {results.map((result) => {
            const listed = songs.find((item) => sameSongTitleArtist(item, { title: result.trackName, artist: result.artistName }))
            return (
              <li key={result.trackId} className="itunes-item">
                <div className="itunes-result">
                  <button
                    type="button"
                    className="preview-button"
                    aria-label={playing === result.trackId ? `השהיית ${result.trackName}` : `השמעת קטע מ-${result.trackName}`}
                    disabled={!result.previewUrl}
                    onClick={() => togglePreview(result)}
                  >
                    {playing === result.trackId ? '❚❚' : '▶'}
                  </button>
                  <button
                    type="button"
                    className="itunes-row"
                    disabled={Boolean(listed) || addingId !== null}
                    onClick={() => void addResult(result)}
                  >
                    {result.artworkUrl100 && <img src={result.artworkUrl100} alt="" width={60} height={60} />}
                    <span className="itunes-copy">
                      <strong>{result.trackName}</strong>
                      <span className="cell-note">{result.artistName}</span>
                      {result.collectionName && <span className="cell-note">{result.collectionName}</span>}
                    </span>
                  </button>
                  {listed ? (
                    <span className="already-badge">כבר ברשימה</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary add-song"
                      disabled={addingId !== null}
                      onClick={() => void addResult(result)}
                    >
                      {addingId === result.trackId ? 'מוסיף…' : '+ הוסף'}
                    </button>
                  )}
                </div>
                {listed && canEdit(listed) && (
                  <label className="field itunes-moment">
                    <span>רגע</span>
                    <select
                      aria-label={`רגע עבור ${listed.title}`}
                      value={listed.moment ?? ''}
                      onChange={(event) => {
                        const next = (event.target.value || null) as SongMomentId | null
                        void onSetMoment(listed, next).catch((failure: unknown) => setError(messageFrom(failure)))
                      }}
                    >
                      <option value="">ללא רגע</option>
                      {SONG_MOMENTS.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!song && !manual && (
        <button type="button" className="text-button" onClick={() => setManual(true)}>
          לא מצאתם? הקלידו ידנית
        </button>
      )}
      {manual && (
        <>
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
            <input value={url} onChange={(event) => setUrl(event.target.value)} dir="ltr" className="ltr-field" inputMode="url" placeholder="https:// או Spotify" />
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
        </>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => { stopPreview(); onCancel() }} disabled={saving || addingId !== null}>ביטול</button>
        {manual && <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'שומר…' : 'שמירה'}</button>}
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

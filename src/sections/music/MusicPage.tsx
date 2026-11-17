import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useAppServices } from '../../app/useAppServices.ts'
import { assignedRole, roleLabel } from '../../domain/roles.ts'
import { lookupItunesSong, searchItunesSongs, type ItunesSong } from '../../domain/itunes.ts'
import {
  canEditSong,
  momentLabel,
  normalizeSong,
  sameSongTitleArtist,
  SONG_MOMENTS,
  type Song,
  type SongDraft,
  type SongMomentId,
} from '../../domain/songs.ts'
import { Fab } from '../../ui/Fab.tsx'
import { OverflowMenu } from '../../ui/OverflowMenu.tsx'
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
  const [deleting, setDeleting] = useState<Song | null>(null)
  const [covers, setCovers] = useState<Record<string, { artworkUrl: string; previewUrl: string }>>({})
  const player = usePreviewPlayer()
  const lookedUp = useRef(new Set<string>())

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

  useEffect(() => {
    if (!songs) return
    let cancelled = false
    const missing = songs.filter((song) => (!song.artworkUrl || !song.previewUrl) && !lookedUp.current.has(song.id))
    void (async () => {
      for (const song of missing) {
        if (cancelled) return
        lookedUp.current.add(song.id)
        const found = await lookupItunesSong(song.title, song.artist).catch(() => null)
        if (cancelled) return
        const artworkUrl = song.artworkUrl || found?.artworkUrl100 || ''
        const previewUrl = song.previewUrl || found?.previewUrl || ''
        setCovers((current) => ({ ...current, [song.id]: { artworkUrl, previewUrl } }))
        if (!found || !canEditSong(app.wedding, app.user?.email ?? null, song)) continue
        if (artworkUrl === song.artworkUrl && previewUrl === song.previewUrl) continue
        await app.songs.update(song.id, {
          title: song.title,
          artist: song.artist,
          url: song.url,
          artworkUrl,
          previewUrl,
          moment: song.moment,
          notes: song.notes,
        }).catch(() => undefined)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [songs, app.songs, app.wedding, app.user])

  function mediaFor(song: Song) {
    const extra = covers[song.id]
    return {
      artworkUrl: song.artworkUrl || extra?.artworkUrl || '',
      previewUrl: song.previewUrl || extra?.previewUrl || '',
    }
  }

  function authorName() {
    if (!app.user) return 'מכשיר זה'
    return app.user.displayName.trim() || app.user.email
  }

  async function save(draft: SongDraft) {
    setSaving(true)
    setError(null)
    try {
      if (editing && editing !== 'new') await app.songs.update(editing.id, draft)
      else {
        await app.songs.create(draft, {
          email: app.user?.email ?? '',
          name: authorName(),
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
      name: authorName(),
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
          {songs && <p className="song-count">{songCountLabel(songs.length)}</p>}
        </div>
      </header>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {error && !editing && <p className="form-error" role="alert">{error}</p>}
      {toast && !editing && <p className="toast" role="status">{toast.text}</p>}
      {songs === null ? (
        <p className="hint">טוען את השירים…</p>
      ) : (
        <>
          <div className="toolbar">
            <label className="search-pill">
              <SearchIcon />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="שם שיר, אמן או הערה" aria-label="חיפוש" />
            </label>
            <div className="chip-row" role="tablist" aria-label="סינון לפי רגע">
              <button type="button" className={moment === 'all' ? 'chip chip-on' : 'chip'} aria-pressed={moment === 'all'} onClick={() => setMoment('all')}>הכל</button>
              <button type="button" className={moment === 'none' ? 'chip chip-on' : 'chip'} aria-pressed={moment === 'none'} onClick={() => setMoment('none')}>ללא רגע</button>
              {SONG_MOMENTS.map((item) => (
                <button key={item.id} type="button" className={moment === item.id ? 'chip chip-on' : 'chip'} aria-pressed={moment === item.id} onClick={() => setMoment(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {songs.length === 0 ? (
            <div className="empty">
              <p className="empty-note" aria-hidden="true">♪</p>
              <h2>עדיין אין שירים</h2>
              <p>לחצו על + והוסיפו את השיר הראשון.</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <h2>אין שירים שתואמים לחיפוש</h2>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.id} className="track-group">
                <h2>{group.label}</h2>
                <ul className="track-list">
                  {group.songs.map((song) => {
                    const media = mediaFor(song)
                    return (
                      <li key={song.id}>
                        <TrackRow
                          title={song.title}
                          artist={song.artist}
                          artworkUrl={media.artworkUrl}
                          previewUrl={media.previewUrl}
                          playing={player.playingId === song.id}
                          progress={player.playingId === song.id ? player.progress : 0}
                          onToggle={() => player.toggle(song.id, media.previewUrl)}
                          meta={
                            <>
                              {song.moment && <span className="moment-chip">{momentLabel(song.moment)}</span>}
                              <span>נוסף על ידי {song.addedByName || 'לא ידוע'}{song.addedByRole ? ` · ${roleLabel(song.addedByRole)}` : ''}</span>
                            </>
                          }
                          end={canEditSong(app.wedding, app.user?.email ?? null, song) ? (
                            <OverflowMenu label={`פעולות עבור ${song.title}`}>
                              <button type="button" role="menuitem" onClick={() => setEditing(song)}>עריכה</button>
                              <button type="button" role="menuitem" className="menu-danger" onClick={() => setDeleting(song)}>מחיקה</button>
                            </OverflowMenu>
                          ) : null}
                        />
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          )}
        </>
      )}
      <Fab label="הוספת שיר" onClick={() => setEditing('new')} />
      <Dialog open={deleting !== null} title="מחיקת שיר" onClose={() => setDeleting(null)}>
        {deleting && (
          <div className="stack-form">
            <p>למחוק את {deleting.title}?</p>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleting(null)}>ביטול</button>
              <button type="button" className="btn btn-danger" onClick={() => { void remove(deleting); setDeleting(null) }}>מחיקה</button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog
        open={editing !== null}
        title={editing && editing !== 'new' ? 'עריכת שיר' : 'הוספת שיר'}
        onClose={() => {
          player.stop()
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
            player={player}
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
  player,
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
  player: PreviewPlayer
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
  const [addingId, setAddingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  async function addResult(result: ItunesSong) {
    const listed = songs.find((item) => sameSongTitleArtist(item, { title: result.trackName, artist: result.artistName }))
    if (listed || addingId !== null) return
    player.stop()
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
    player.stop()
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
        <ul className="track-list track-search">
          {results.map((result) => {
            const listed = songs.find((item) => sameSongTitleArtist(item, { title: result.trackName, artist: result.artistName }))
            return (
              <li key={result.trackId}>
                <TrackRow
                  title={result.trackName}
                  artist={result.artistName}
                  artworkUrl={result.artworkUrl100}
                  previewUrl={result.previewUrl}
                  playing={player.playingId === `itunes-${result.trackId}`}
                  progress={player.playingId === `itunes-${result.trackId}` ? player.progress : 0}
                  onToggle={() => player.toggle(`itunes-${result.trackId}`, result.previewUrl)}
                  onActivate={listed || addingId !== null ? undefined : () => void addResult(result)}
                  meta={result.collectionName ? <span>{result.collectionName}</span> : null}
                  end={listed ? (
                    <span className="already-badge">כבר ברשימה</span>
                  ) : (
                    <button type="button" className="btn btn-primary add-song" disabled={addingId !== null} onClick={() => void addResult(result)}>
                      {addingId === result.trackId ? 'מוסיף…' : '+ הוסף'}
                    </button>
                  )}
                />
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
        <button type="button" className="btn btn-ghost" onClick={() => { player.stop(); onCancel() }} disabled={saving || addingId !== null}>ביטול</button>
        {manual && <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'שומר…' : 'שמירה'}</button>}
      </div>
    </form>
  )
}

type PreviewPlayer = ReturnType<typeof usePreviewPlayer>

function usePreviewPlayer() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const player = new Audio()
    audio.current = player
    const onTime = () => setProgress(player.duration ? player.currentTime / player.duration : 0)
    const onEnded = () => {
      setPlayingId(null)
      setProgress(0)
    }
    const onHide = () => {
      if (!document.hidden) return
      player.pause()
      setPlayingId(null)
    }
    player.addEventListener('timeupdate', onTime)
    player.addEventListener('ended', onEnded)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      player.pause()
      player.removeEventListener('timeupdate', onTime)
      player.removeEventListener('ended', onEnded)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  function toggle(id: string, url: string) {
    const player = audio.current
    if (!player || !url) return
    if (playingId === id && !player.paused) {
      player.pause()
      setPlayingId(null)
      return
    }
    if (player.src !== url) player.src = url
    setPlayingId(id)
    setProgress(0)
    void player.play()
  }

  function stop() {
    audio.current?.pause()
    setPlayingId(null)
    setProgress(0)
  }

  return { playingId, progress, toggle, stop }
}

function TrackRow({
  title,
  artist,
  artworkUrl,
  previewUrl,
  playing,
  progress,
  onToggle,
  onActivate,
  meta,
  end,
}: {
  title: string
  artist: string
  artworkUrl: string
  previewUrl: string
  playing: boolean
  progress: number
  onToggle: () => void
  onActivate?: () => void
  meta: ReactNode
  end: ReactNode
}) {
  const dash = 100.5
  return (
    <div className="track-row">
      <button
        type="button"
        className="track-art"
        disabled={!previewUrl}
        aria-label={previewUrl ? (playing ? `השהיית ${title}` : `השמעת קטע מ-${title}`) : title}
        onClick={previewUrl ? onToggle : undefined}
      >
        {artworkUrl ? <img src={artworkUrl} alt="" /> : <span className="track-placeholder" aria-hidden="true">♪</span>}
        {previewUrl && <span className="track-play" aria-hidden="true">{playing ? '❚❚' : '▶'}</span>}
        {playing && (
          <svg className="track-ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="16" />
            <circle cx="18" cy="18" r="16" style={{ strokeDasharray: dash, strokeDashoffset: dash * (1 - progress) }} />
          </svg>
        )}
      </button>
      {onActivate ? (
        <button type="button" className="track-copy" onClick={onActivate}>
          <strong>{title}</strong>
          {artist && <span className="track-artist">{artist}</span>}
          <span className="track-meta">{meta}</span>
        </button>
      ) : (
        <div className="track-copy">
          <strong>{title}</strong>
          {artist && <span className="track-artist">{artist}</span>}
          <span className="track-meta">{meta}</span>
        </div>
      )}
      {end}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 4a6.5 6.5 0 0 1 5.1 10.5l4 4-1.4 1.4-4-4A6.5 6.5 0 1 1 10.5 4zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" fill="currentColor" />
    </svg>
  )
}

function songCountLabel(count: number): string {
  if (count === 1) return 'שיר אחד'
  return `${count} שירים`
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

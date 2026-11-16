import { useEffect, useMemo, useState } from 'react'
import { useAppServices } from '../../app/useAppServices.ts'
import { guestsToAppCsv } from '../../domain/csv.ts'
import { PRESET_GROUPS, RSVP_LABELS, sideLabel } from '../../domain/labels.ts'
import { EMPTY_QUERY, groupOptions, queryGuests } from '../../domain/query.ts'
import type { GuestQuery } from '../../domain/query.ts'
import { RSVP_STATUSES, SIDES } from '../../domain/types.ts'
import type { Guest, GuestDraft } from '../../domain/types.ts'
import { summarizeGuests } from '../../domain/stats.ts'
import { Dialog } from '../../ui/Dialog.tsx'
import { downloadTextFile } from '../../ui/download.ts'
import { messageFrom } from '../../ui/messageFrom.ts'
import { ContactsImportDialog } from './ContactsImportDialog.tsx'
import { GuestForm } from './GuestForm.tsx'
import { Summary } from './Summary.tsx'

type Modal =
  | { type: 'none' }
  | { type: 'form'; guest: Guest | null }
  | { type: 'delete'; guest: Guest }
  | { type: 'contacts' }

export function GuestListPage() {
  const app = useAppServices()
  const [guests, setGuests] = useState<Guest[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState<GuestQuery>(EMPTY_QUERY)
  const [modal, setModal] = useState<Modal>({ type: 'none' })
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    return app.guests.subscribe(
      (next) => {
        setGuests(next)
        setLoadError(null)
      },
      (error) => setLoadError(messageFrom(error)),
    )
  }, [app.guests])

  const visible = useMemo(() => (guests ? queryGuests(guests, query) : []), [guests, query])
  const stats = useMemo(() => summarizeGuests(guests ?? []), [guests])
  const groups = useMemo(() => groupOptions(guests ?? []), [guests])
  const formGroups = useMemo(() => [...new Set([...PRESET_GROUPS, ...groups])], [groups])
  const filtersActive = query.search !== '' || query.side !== 'all' || query.group !== 'all' || query.rsvp !== 'all'

  async function saveGuest(draft: GuestDraft) {
    setSaving(true)
    setActionError(null)
    try {
      if (modal.type === 'form' && modal.guest) await app.guests.update(modal.guest.id, draft)
      else await app.guests.create(draft)
      setModal({ type: 'none' })
    } catch (error) {
      setActionError(messageFrom(error))
      throw error
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (modal.type !== 'delete') return
    setSaving(true)
    setActionError(null)
    try {
      await app.guests.remove(modal.guest.id)
      setModal({ type: 'none' })
    } catch (error) {
      setActionError(messageFrom(error))
    } finally {
      setSaving(false)
    }
  }

  async function importContacts(drafts: GuestDraft[]) {
    for (const draft of drafts) await app.guests.create(draft)
    setBanner(`נוספו ${drafts.length} אנשי קשר.`)
    setModal({ type: 'none' })
  }

  return (
    <section className="page" data-testid="guest-list">
      <header className="page-header">
        <div>
          <h1>רשימת מוזמנים</h1>
          <p>הוספה, אישורי הגעה, וסינון לפי צד, קבוצה וסטטוס.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" data-testid="add-guest" onClick={() => setModal({ type: 'form', guest: null })}>
            הוספת מוזמן
          </button>
          <button type="button" className="btn btn-ghost" disabled={!guests} onClick={() => downloadTextFile('guest-list.csv', guestsToAppCsv(guests ?? []))}>
            ייצוא CSV
          </button>
          <button type="button" className="btn btn-ghost" disabled={!guests} onClick={() => setModal({ type: 'contacts' })}>
            ייבוא מאנשי קשר
          </button>
        </div>
      </header>

      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {banner && <p className="banner" role="status">{banner}</p>}

      {guests === null ? (
        <p className="hint" role="status">טוען את הרשימה…</p>
      ) : (
        <>
          {guests.length === 0 ? (
            <div className="empty">
              <h2>עדיין אין מוזמנים</h2>
              <p>הוסיפו אורח ראשון, או ייבאו מאנשי הקשר.</p>
              <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'form', guest: null })}>
                הוספת מוזמן
              </button>
            </div>
          ) : (
          <>
          <Summary stats={stats} />
          <div className="toolbar">
            <label className="field grow">
              <span>חיפוש</span>
              <input
                value={query.search}
                onChange={(event) => setQuery({ ...query, search: event.target.value })}
                placeholder="חיפוש לפי שם, טלפון או הערה"
              />
            </label>
            <label className="field">
              <span>צד</span>
              <select value={query.side} onChange={(event) => setQuery({ ...query, side: event.target.value as GuestQuery['side'] })}>
                <option value="all">הכל</option>
                {SIDES.map((side) => (
                  <option key={side} value={side}>{sideLabel(side)}</option>
                ))}
                <option value="unspecified">לא צוין</option>
              </select>
            </label>
            <label className="field">
              <span>קבוצה</span>
              <select value={query.group} onChange={(event) => setQuery({ ...query, group: event.target.value })}>
                <option value="all">הכל</option>
                {groups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>סטטוס</span>
              <select value={query.rsvp} onChange={(event) => setQuery({ ...query, rsvp: event.target.value as GuestQuery['rsvp'] })}>
                <option value="all">הכל</option>
                {RSVP_STATUSES.map((status) => (
                  <option key={status} value={status}>{RSVP_LABELS[status]}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setQuery({ ...query, sort: query.sort === 'asc' ? 'desc' : 'asc' })}
            >
              {query.sort === 'asc' ? 'מיון: א׳–ת׳' : 'מיון: ת׳–א׳'}
            </button>
          </div>
          <p className="result-count">
            {filtersActive ? `מציג ${visible.length} מתוך ${guests.length}` : `${guests.length} רשומות`}
            {filtersActive && (
              <button type="button" className="text-button" onClick={() => setQuery(EMPTY_QUERY)}>
                ניקוי סינון
              </button>
            )}
          </p>

          {visible.length === 0 ? (
            <div className="empty">
              <h2>אין מוזמנים שתואמים לסינון</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setQuery(EMPTY_QUERY)}>
                ניקוי סינון
              </button>
            </div>
          ) : (
            <>
              <div className="table-scroll guest-table-wrap">
                <table className="guest-table">
                  <thead>
                    <tr>
                      <th>שם</th>
                      <th>טלפון</th>
                      <th>צד</th>
                      <th>קבוצה</th>
                      <th>אנשים</th>
                      <th>סטטוס</th>
                      <th>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((guest) => (
                      <tr key={guest.id}>
                        <td>
                          <strong>{guest.fullName}</strong>
                          {guest.notes && <span className="cell-note">{guest.notes}</span>}
                        </td>
                        <td className="ltr-inline" dir="ltr">{guest.phone || '—'}</td>
                        <td>{sideLabel(guest.side)}</td>
                        <td>{guest.group || '—'}</td>
                        <td>
                          {guest.partySize}
                          {guest.partySizeAssumed && <span className="badge badge-assumed">לא צוין</span>}
                        </td>
                        <td><span className={`badge badge-${guest.rsvp}`}>{RSVP_LABELS[guest.rsvp]}</span></td>
                        <td className="row-actions">
                          <button type="button" className="btn btn-ghost btn-small" onClick={() => setModal({ type: 'form', guest })}>עריכה</button>
                          <button type="button" className="btn btn-danger btn-small" onClick={() => setModal({ type: 'delete', guest })}>מחיקה</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="guest-cards">
                {visible.map((guest) => (
                  <article key={guest.id} className="guest-card">
                    <div className="guest-card-top">
                      <h2>{guest.fullName}</h2>
                      <span className={`badge badge-${guest.rsvp}`}>{RSVP_LABELS[guest.rsvp]}</span>
                    </div>
                    <p>{guest.group || 'ללא קבוצה'}</p>
                    <p className="guest-meta">
                      <span className="ltr-inline" dir="ltr">{guest.phone || 'בלי טלפון'}</span>
                      <span>{guest.partySize} אנשים</span>
                      <span>{sideLabel(guest.side)}</span>
                      {guest.partySizeAssumed && <span className="badge badge-assumed">לא צוין</span>}
                    </p>
                    {guest.notes && <p className="cell-note">{guest.notes}</p>}
                    <div className="row-actions">
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => setModal({ type: 'form', guest })}>עריכה</button>
                      <button type="button" className="btn btn-danger btn-small" onClick={() => setModal({ type: 'delete', guest })}>מחיקה</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          </>
          )}
          <p className="storage-note">
            {app.mode === 'local'
              ? 'הנתונים נשמרים בדפדפן זה בלבד.'
              : `הרשימה מסונכרנת בענן${app.wedding ? ` · ${app.wedding.name}` : ''}.`}
          </p>
        </>
      )}

      <Dialog
        open={modal.type === 'form'}
        title={modal.type === 'form' && modal.guest ? 'עריכת מוזמן' : 'הוספת מוזמן'}
        onClose={() => setModal({ type: 'none' })}
      >
        {modal.type === 'form' && (
          <GuestForm
            key={modal.guest?.id ?? 'new'}
            guest={modal.guest}
            groups={formGroups}
            saving={saving}
            onCancel={() => setModal({ type: 'none' })}
            onSubmit={saveGuest}
            onDelete={modal.guest ? () => setModal({ type: 'delete', guest: modal.guest as Guest }) : undefined}
          />
        )}
      </Dialog>

      <Dialog open={modal.type === 'delete'} title="מחיקת מוזמן" onClose={() => setModal({ type: 'none' })}>
        {modal.type === 'delete' && (
          <div className="stack-form">
            <p>למחוק את {modal.guest.fullName} מהרשימה? אי אפשר לשחזר את המחיקה.</p>
            {actionError && <p className="form-error" role="alert">{actionError}</p>}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModal({ type: 'none' })} disabled={saving}>ביטול</button>
              <button type="button" className="btn btn-danger" onClick={() => void confirmDelete()} disabled={saving}>
                {saving ? 'מוחק…' : 'מחיקה'}
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={modal.type === 'contacts'} title="ייבוא מאנשי קשר" onClose={() => setModal({ type: 'none' })}>
        {modal.type === 'contacts' && (
          <ContactsImportDialog
            guests={guests ?? []}
            groups={formGroups}
            onClose={() => setModal({ type: 'none' })}
            onCreate={importContacts}
          />
        )}
      </Dialog>
    </section>
  )
}

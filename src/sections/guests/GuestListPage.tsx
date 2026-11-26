import { useEffect, useMemo, useState } from 'react'
import { useAppServices } from '../../app/useAppServices.ts'
import { guestsToAppCsv } from '../../domain/csv.ts'
import { ancestorChain, childrenOf, legacyCategory, pathLabel, subtreeIds } from '../../domain/guestCategories.ts'
import { CATEGORY_LABELS, RSVP_LABELS, SUB_SIDE_LABELS, sideLabel } from '../../domain/labels.ts'
import { assignedRole, canEditGuest, isCoupleOrOwner, placementForRole } from '../../domain/roles.ts'
import { EMPTY_QUERY, queryGuests } from '../../domain/query.ts'
import type { GuestQuery } from '../../domain/query.ts'
import { RSVP_STATUSES, SIDES, SUB_SIDES } from '../../domain/types.ts'
import type { Guest, GuestDraft } from '../../domain/types.ts'
import { summarizeGuests } from '../../domain/stats.ts'
import { Dialog } from '../../ui/Dialog.tsx'
import { OverflowMenu } from '../../ui/OverflowMenu.tsx'
import { downloadTextFile } from '../../ui/download.ts'
import { Fab } from '../../ui/Fab.tsx'
import { messageFrom } from '../../ui/messageFrom.ts'
import { CategoryTreeEditor } from './CategoryTreeEditor.tsx'
import { ContactsImportDialog } from './ContactsImportDialog.tsx'
import { GuestForm } from './GuestForm.tsx'
import { Summary } from './Summary.tsx'

function categoryTrailLabel(categories: Parameters<typeof pathLabel>[0], guest: Guest): string {
  return pathLabel(categories, guest.categoryId) || guest.group.trim() || CATEGORY_LABELS[guest.category]
}

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
  const [treeOpen, setTreeOpen] = useState(false)

  useEffect(() => {
    return app.guests.subscribe(
      (next) => {
        setGuests(next)
        setLoadError(null)
      },
      (error) => setLoadError(messageFrom(error)),
    )
  }, [app.guests])

  const visible = useMemo(
    () => (guests ? queryGuests(guests, query, app.guestCategories) : []),
    [guests, query, app.guestCategories],
  )
  const stats = useMemo(() => summarizeGuests(guests ?? []), [guests])
  const filtersActive = query.search !== '' || query.side !== 'all' || query.subSide !== 'all' || query.category !== 'all' || query.rsvp !== 'all'
  const viewerEmail = app.user?.email ?? null
  const placement = placementForRole(assignedRole(app.wedding, viewerEmail))
  const canReclassify = isCoupleOrOwner(app.wedding, viewerEmail)
  const categoryTrail = query.category === 'all' ? [] : ancestorChain(app.guestCategories, query.category)
  const categoryChoices = childrenOf(app.guestCategories, query.category === 'all' ? '' : query.category)

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
    await app.guests.importContacts(drafts)
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
          <button type="button" className="btn btn-ghost" disabled={!guests} onClick={() => downloadTextFile('guest-list.csv', guestsToAppCsv(guests ?? []))}>
            ייצוא CSV
          </button>
          <button type="button" className="btn btn-ghost" disabled={!guests} onClick={() => setModal({ type: 'contacts' })}>
            ייבוא מאנשי קשר
          </button>
          {app.onSetGuestCategories && (
            <button type="button" className="btn btn-ghost" onClick={() => setTreeOpen(true)}>עץ קטגוריות</button>
          )}
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
          <Summary stats={stats} guests={guests} categories={app.guestCategories} />
          <div className="toolbar">
            <label className="field grow">
              <span>חיפוש</span>
              <input
                value={query.search}
                onChange={(event) => setQuery({ ...query, search: event.target.value })}
                placeholder="חיפוש לפי שם, טלפון או הערה"
              />
            </label>
            <div className="chip-row" role="tablist" aria-label="סינון לפי קירבה">
              <button type="button" className={query.subSide === 'all' ? 'chip chip-on' : 'chip'} aria-pressed={query.subSide === 'all'} onClick={() => setQuery({ ...query, subSide: 'all' })}>הכל</button>
              {SUB_SIDES.map((item) => (
                <button key={item} type="button" className={query.subSide === item ? 'chip chip-on' : 'chip'} aria-pressed={query.subSide === item} onClick={() => setQuery({ ...query, subSide: item })}>
                  {SUB_SIDE_LABELS[item]}
                </button>
              ))}
            </div>
            <div className="chip-row" role="tablist" aria-label="סינון לפי צד">
              <button type="button" className={query.side === 'all' ? 'chip chip-on' : 'chip'} aria-pressed={query.side === 'all'} onClick={() => setQuery({ ...query, side: 'all' })}>הכל</button>
              {SIDES.map((side) => (
                <button key={side} type="button" className={query.side === side ? 'chip chip-on' : 'chip'} aria-pressed={query.side === side} onClick={() => setQuery({ ...query, side })}>
                  {sideLabel(side)}
                </button>
              ))}
              <button type="button" className={query.side === 'unspecified' ? 'chip chip-on' : 'chip'} aria-pressed={query.side === 'unspecified'} onClick={() => setQuery({ ...query, side: 'unspecified' })}>לא צוין</button>
            </div>
            <div className="chip-row" role="tablist" aria-label="סינון לפי קטגוריה">
              <button type="button" className={query.category === 'all' ? 'chip chip-on' : 'chip'} aria-pressed={query.category === 'all'} onClick={() => setQuery({ ...query, category: 'all' })}>הכל</button>
              {categoryTrail.map((category) => (
                <button key={category.id} type="button" className={query.category === category.id ? 'chip chip-on' : 'chip'} aria-pressed={query.category === category.id} onClick={() => setQuery({ ...query, category: category.id })}>
                  {category.label}
                </button>
              ))}
              {categoryChoices.map((category) => {
                const people = (guests ?? []).filter((guest) => subtreeIds(app.guestCategories, category.id).includes(guest.categoryId)).reduce((sum, guest) => sum + guest.partySize, 0)
                return (
                  <button key={category.id} type="button" className="chip" aria-pressed={false} onClick={() => setQuery({ ...query, category: category.id })}>
                    {category.label} {people}
                  </button>
                )
              })}
            </div>
            <div className="chip-row" role="tablist" aria-label="סינון לפי סטטוס">
              <button type="button" className={query.rsvp === 'all' ? 'chip chip-on' : 'chip'} aria-pressed={query.rsvp === 'all'} onClick={() => setQuery({ ...query, rsvp: 'all' })}>הכל</button>
              {RSVP_STATUSES.map((status) => (
                <button key={status} type="button" className={query.rsvp === status ? 'chip chip-on' : 'chip'} aria-pressed={query.rsvp === status} onClick={() => setQuery({ ...query, rsvp: status })}>
                  {RSVP_LABELS[status]}
                </button>
              ))}
            </div>
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
                      <th>קירבה</th>
                      <th>צד</th>
                      <th>קטגוריה</th>
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
                        <td>{guest.subSide === 'none' ? '—' : SUB_SIDE_LABELS[guest.subSide]}</td>
                        <td>{sideLabel(guest.side)}</td>
                        <td>{categoryTrailLabel(app.guestCategories, guest)}</td>
                        <td>
                          {guest.partySize}
                          {guest.partySizeAssumed && <span className="badge badge-assumed">לא צוין</span>}
                        </td>
                        <td><span className={`badge badge-${guest.rsvp}`}>{RSVP_LABELS[guest.rsvp]}</span></td>
                        <td className="row-actions">
                          {canEditGuest(app.wedding, viewerEmail, guest) && (
                            <OverflowMenu label={`פעולות עבור ${guest.fullName}`}>
                              <button type="button" role="menuitem" onClick={() => setModal({ type: 'form', guest })}>עריכה</button>
                              <button type="button" role="menuitem" className="menu-danger" onClick={() => setModal({ type: 'delete', guest })}>מחיקה</button>
                            </OverflowMenu>
                          )}
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
                      {canEditGuest(app.wedding, viewerEmail, guest) && (
                        <OverflowMenu label={`פעולות עבור ${guest.fullName}`}>
                          <button type="button" role="menuitem" onClick={() => setModal({ type: 'form', guest })}>עריכה</button>
                          <button type="button" role="menuitem" className="menu-danger" onClick={() => setModal({ type: 'delete', guest })}>מחיקה</button>
                        </OverflowMenu>
                      )}
                    </div>
                    <p className="guest-chips">
                      <span className="mini-chip">{sideLabel(guest.side)}</span>
                      {guest.subSide !== 'none' && <span className="mini-chip">{SUB_SIDE_LABELS[guest.subSide]}</span>}
                      <span className="mini-chip">{categoryTrailLabel(app.guestCategories, guest)}</span>
                    </p>
                    <p className="guest-meta">
                      <span className="ltr-inline" dir="ltr">{guest.phone || 'בלי טלפון'}</span>
                      <span>{guest.partySize} אנשים</span>
                      {guest.partySizeAssumed && <span className="badge badge-assumed">לא צוין</span>}
                    </p>
                    {guest.notes && <p className="cell-note">{guest.notes}</p>}
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
            saving={saving}
            placement={placement}
            canReclassify={canReclassify}
            categories={app.guestCategories}
            onCancel={() => setModal({ type: 'none' })}
            onSubmit={saveGuest}
            onDelete={modal.guest ? () => setModal({ type: 'delete', guest: modal.guest as Guest }) : undefined}
          />
        )}
      </Dialog>

      <Dialog open={treeOpen} title="עץ קטגוריות" onClose={() => setTreeOpen(false)}>
        {treeOpen && app.onSetGuestCategories && (
          <CategoryTreeEditor
            categories={app.guestCategories}
            onClose={() => setTreeOpen(false)}
            onSave={async (next) => {
              const removed = app.guestCategories.filter((category) => !next.some((item) => item.id === category.id))
              await app.onSetGuestCategories!(next)
              for (const category of removed) {
                const parentId = category.parentId
                for (const guest of guests ?? []) {
                  if (guest.categoryId !== category.id) continue
                  const label = next.find((item) => item.id === parentId)?.label ?? ''
                  await app.guests.update(guest.id, { ...guest, categoryId: parentId, group: label, category: legacyCategory(next, parentId) })
                }
              }
            }}
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

      <Fab label="הוספת מוזמן" testId="add-guest" onClick={() => setModal({ type: 'form', guest: null })} />
      <Dialog open={modal.type === 'contacts'} title="ייבוא מאנשי קשר" onClose={() => setModal({ type: 'none' })}>
        {modal.type === 'contacts' && (
          <ContactsImportDialog
            guests={guests ?? []}
            placement={placement}
            onClose={() => setModal({ type: 'none' })}
            onCreate={importContacts}
          />
        )}
      </Dialog>
    </section>
  )
}

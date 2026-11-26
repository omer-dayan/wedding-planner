import { useMemo, useState } from 'react'
import { CATEGORY_LABELS, SUB_SIDE_LABELS, sideLabel } from '../../domain/labels.ts'
import { CATEGORIES } from '../../domain/types.ts'
import type { Category, Guest, GuestDraft, SubSide } from '../../domain/types.ts'
import { contactsMatch, parseVCards, type ParsedContact } from '../../domain/vcard.ts'
import { messageFrom } from '../../ui/messageFrom.ts'

interface ContactInfo {
  name?: string[]
  tel?: string[]
}

interface ContactsManager {
  select(properties: Array<'name' | 'tel'>, options?: { multiple?: boolean }): Promise<ContactInfo[]>
}

interface PreviewRow extends ParsedContact {
  key: string
  selected: boolean
  duplicate: boolean
}

function contactPicker(): ContactsManager | null {
  if (!('contacts' in navigator)) return null
  const manager = (navigator as Navigator & { contacts?: ContactsManager }).contacts
  if (!manager || typeof manager.select !== 'function') return null
  return manager
}

function rowsFromContacts(contacts: readonly ParsedContact[], guests: readonly Guest[]): PreviewRow[] {
  return contacts
    .filter((contact) => contact.fullName.trim())
    .map((contact, index) => {
      const duplicate = guests.some((guest) => contactsMatch(guest, contact))
      return { ...contact, key: `${index}-${contact.fullName}-${contact.phone}`, selected: !duplicate, duplicate }
    })
}

export function ContactsImportDialog({
  guests,
  placement,
  onClose,
  onCreate,
}: {
  guests: readonly Guest[]
  placement: { side: 'groom' | 'bride'; subSide: SubSide }
  onClose: () => void
  onCreate: (drafts: GuestDraft[]) => Promise<void>
}) {
  const picker = useMemo(() => contactPicker(), [])
  const [rows, setRows] = useState<PreviewRow[] | null>(null)
  const [category, setCategory] = useState<Category>('family')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function showContacts(contacts: readonly ParsedContact[]) {
    const next = rowsFromContacts(contacts, guests)
    setRows(next)
    if (next.length === 0) setError('לא נמצאו אנשי קשר עם שם.')
  }

  async function pickFromDevice() {
    if (!picker) return
    setError(null)
    setBusy(true)
    try {
      const picked = await picker.select(['name', 'tel'], { multiple: true })
      showContacts(
        picked.flatMap((contact) => {
          const fullName = (contact.name?.[0] ?? '').trim().replace(/\s+/g, ' ')
          if (!fullName) return []
          return [{ fullName, phone: (contact.tel?.[0] ?? '').trim() }]
        }),
      )
    } catch (failure) {
      if (failure instanceof DOMException && (failure.name === 'AbortError' || failure.name === 'NotAllowedError')) return
      setError(messageFrom(failure))
    } finally {
      setBusy(false)
    }
  }

  async function readFiles(files: FileList) {
    setError(null)
    setBusy(true)
    try {
      const texts = await Promise.all([...files].map((file) => file.text()))
      showContacts(texts.flatMap((text) => parseVCards(text)))
    } catch (failure) {
      setError(messageFrom(failure))
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!rows) return
    const drafts: GuestDraft[] = rows
      .filter((row) => row.selected)
      .map((row) => ({
        fullName: row.fullName,
        phone: row.phone,
        side: placement.side,
        subSide: placement.subSide,
        category,
        categoryId: '',
        role: null,
        group: '',
        partySize: 1,
        partySizeAssumed: false,
        rsvp: 'pending',
        notes: '',
      }))
    if (drafts.length === 0) {
      setError('בחרו לפחות איש קשר אחד.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onCreate(drafts)
    } catch (failure) {
      setError(messageFrom(failure))
      setBusy(false)
    }
  }

  return (
    <div className="stack-form">
      {!rows && (
        <>
          <p className="hint">
            באייפון: פתח את אנשי הקשר, בחר איש קשר, לחץ "שתף איש קשר" ושמור לקבצים, ואז בחר את הקובץ כאן.
          </p>
          {picker && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void pickFromDevice()}>
              בחירה מאנשי הקשר
            </button>
          )}
          <label className="btn btn-ghost file-button">
            בחירת קובץ vCard
            <input
              type="file"
              accept=".vcf,text/vcard,text/x-vcard"
              multiple
              hidden
              disabled={busy}
              onChange={(event) => {
                const files = event.target.files
                event.target.value = ''
                if (files && files.length > 0) void readFiles(files)
              }}
            />
          </label>
        </>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="import-options">
            <p className="locked-placement">
              <span className="mini-chip">{sideLabel(placement.side)}</span>
              <span className="mini-chip">{SUB_SIDE_LABELS[placement.subSide]}</span>
            </p>
            <div className="segment" role="radiogroup" aria-label="קטגוריה">
              {CATEGORIES.map((item) => (
                <button key={item} type="button" className={category === item ? 'segment-on' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>
                  {CATEGORY_LABELS[item]}
                </button>
              ))}
            </div>
          </div>
          <ul className="contact-list">
            {rows.map((row) => (
              <li key={row.key} className="contact-row">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(event) => {
                    const selected = event.target.checked
                    setRows((current) => current?.map((item) => (item.key === row.key ? { ...item, selected } : item)) ?? null)
                  }}
                  aria-label={row.fullName}
                />
                <div>
                  <strong>{row.fullName}</strong>
                  {row.phone && (
                    <span className="ltr-inline contact-phone" dir="ltr">
                      {row.phone}
                    </span>
                  )}
                  {row.duplicate && <span className="badge badge-assumed">כבר ברשימה</span>}
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>
            {busy ? 'מייבא…' : `ייבוא ${rows.filter((row) => row.selected).length}`}
          </button>
        </>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
        סגירה
      </button>
    </div>
  )
}

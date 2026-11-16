import { useState } from 'react'
import type { FormEvent } from 'react'
import { fetchGoogleSheetCsv } from '../../domain/googleSheet.ts'
import { messageFrom } from '../../ui/messageFrom.ts'

export function SheetImportDialog({
  onImport,
  onClose,
}: {
  onImport: (csv: string) => Promise<void>
  onClose: () => void
}) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function importText(text: string) {
    setBusy(true)
    setError(null)
    try {
      await onImport(text)
    } catch (failure) {
      setError(messageFrom(failure))
      setBusy(false)
    }
  }

  async function handleUrl(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const csv = await fetchGoogleSheetCsv(url)
      await onImport(csv)
    } catch (failure) {
      setError(messageFrom(failure))
      setBusy(false)
    }
  }

  return (
    <div className="stack-form">
      <p>
        הדביקו קישור לשיתוף של גיליון ציבורי (כל מי שיש לו את הקישור). אפשר גם להעלות קובץ CSV באותו פורמט, בלי
        שורת כותרת: קטגוריה, תת-קטגוריה, שם, מספר. קטגוריה ותת-קטגוריה שנכתבו בראש בלוק ממשיכות לשורות שאחריהן,
        וקטגוריה חדשה מאפסת את תת-הקטגוריה. שורה בלי שם היא כותרת בלבד.
      </p>
      <p>
        ייבוא חוזר מעדכן מוזמנים קיימים לפי השם ולא יוצר כפילויות. סטטוס הגעה, טלפון, צד והערות שכבר מולאו נשמרים.
        מוזמנים חדשים נכנסים כממתינים ובלי צד. אם אין מספר אנשים, נשמר 1 ומסומן שלא צוין.
      </p>
      <form onSubmit={(event) => void handleUrl(event)} className="stack-form">
        <label className="field">
          <span>קישור לשיתוף</span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            dir="ltr"
            className="ltr-field"
            inputMode="url"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy || url.trim() === ''}>
          {busy ? 'מייבא…' : 'ייבוא מהקישור'}
        </button>
      </form>
      <p className="or-divider">או</p>
      <label className="btn btn-ghost file-button">
        העלאת קובץ CSV
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void file.text().then((text) => importText(text))
          }}
        />
      </label>
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

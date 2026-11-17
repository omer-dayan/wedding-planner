import { errorText } from '../domain/labels.ts'
import { Rings } from '../ui/Rings.tsx'

export function SignInScreen({
  busy,
  errorCode,
  onGoogle,
}: {
  busy: boolean
  errorCode: string | null
  onGoogle: () => void
}) {
  return (
    <main className="sign-in" data-testid="sign-in">
      <section className="sign-in-card">
        <Rings />
        <p className="brand-kicker">החתונה שלנו</p>
        <h1>תכנון חתונה</h1>
        <p className="lede">רשימת המוזמנים נשמרת בענן וזמינה גם בטלפון וגם במחשב.</p>
        <p>אחרי ההתחברות אפשר לשתף את הרשימה עם בן או בת הזוג, לפי כתובת ה-Google שלהם.</p>
        {errorCode && (
          <>
            <p className="form-error" role="alert">{errorText(errorCode)}</p>
            <p className="hint">אם זה קורה מהאפליקציה במסך הבית, פתחו את האתר בספארי והתחברו שם פעם אחת.</p>
          </>
        )}
        <button
          type="button"
          className="btn btn-primary google-button"
          data-testid="sign-in-button"
          disabled={busy}
          onClick={() => void onGoogle()}
        >
          {busy ? 'מתחברים…' : errorCode ? 'נסו שוב' : 'התחברות עם Google'}
        </button>
        <p className="fine-print">ההתחברות היא עם חשבון Google. הנתונים גלויים רק למי שנוסף לרשימת השותפים.</p>
      </section>
    </main>
  )
}

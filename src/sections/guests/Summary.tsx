import type { GuestStats } from '../../domain/stats.ts'
import type { Guest } from '../../domain/types.ts'
import { SideSplit } from './SideSplit.tsx'

const CARDS = [
  ['total', 'סה״כ מוזמנים', 'הזמנות'],
  ['attending', 'מגיעים', 'אישרו הגעה'],
  ['declined', 'לא מגיעים', 'לא יגיעו'],
  ['pending', 'ממתינים', 'עדיין בלי תשובה'],
  ['maybe', 'אולי', 'עוד לא סגור'],
] as const

export function Summary({ stats, guests = [] }: { stats: GuestStats; guests?: readonly Guest[] }) {
  const values = {
    total: stats.overall.people,
    attending: stats.overall.attending,
    declined: stats.overall.declined,
    pending: stats.overall.pending,
    maybe: stats.overall.maybe,
  }

  return (
    <section className="summary" aria-label="סיכום מוזמנים">
      <div className="stats">
        {CARDS.map(([key, label, hint]) => (
          <article key={key} className={`stat-card stat-${key}`} data-testid={`summary-${key}`}>
            <p className="stat-label">{label}</p>
            <p className="stat-value">
              <span>{values[key].toLocaleString('he-IL')}</span>
              {key === 'total' && stats.overall.children > 0 && (
                <span className="stat-children" dir="ltr">+{stats.overall.children.toLocaleString('he-IL')}</span>
              )}
            </p>
            <p className="stat-hint">
              {key === 'total' ? `${stats.overall.records.toLocaleString('he-IL')} ${hint}` : hint}
            </p>
          </article>
        ))}
      </div>
      <SideSplit guests={guests} />
      {stats.overall.assumedRecords > 0 && (
        <p className="hint">
          ב-{stats.overall.assumedRecords.toLocaleString('he-IL')} רשומות לא צוין מספר אנשים, והן נספרות כ-1 עד
          שתעדכנו אותן.
        </p>
      )}
    </section>
  )
}

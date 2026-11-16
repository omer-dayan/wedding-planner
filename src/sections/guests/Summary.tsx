import { sideLabel } from '../../domain/labels.ts'
import type { GuestStats, SideKey } from '../../domain/stats.ts'

const SIDE_ORDER: SideKey[] = ['groom', 'bride', 'shared', 'unspecified']

const CARDS = [
  ['total', 'סה״כ מוזמנים', 'הזמנות'],
  ['attending', 'מגיעים', 'אישרו הגעה'],
  ['declined', 'לא מגיעים', 'לא יגיעו'],
  ['pending', 'ממתינים', 'עדיין בלי תשובה'],
  ['maybe', 'אולי', 'עוד לא סגור'],
] as const

export function Summary({ stats }: { stats: GuestStats }) {
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
            <p className="stat-value">{values[key].toLocaleString('he-IL')}</p>
            <p className="stat-hint">
              {key === 'total' ? `${stats.overall.records.toLocaleString('he-IL')} ${hint}` : hint}
            </p>
          </article>
        ))}
      </div>
      <div className="side-panel">
        <h2>לפי צד</h2>
        <div className="table-scroll">
          <table className="side-table">
            <thead>
              <tr>
                <th>צד</th>
                <th>אנשים</th>
                <th>מגיעים</th>
                <th>לא מגיעים</th>
                <th>ממתינים</th>
                <th>אולי</th>
              </tr>
            </thead>
            <tbody>
              {SIDE_ORDER.map((side) => {
                const counts = stats.bySide[side]
                return (
                  <tr key={side}>
                    <th scope="row">{side === 'unspecified' ? 'לא צוין' : sideLabel(side)}</th>
                    <td>{counts.people}</td>
                    <td>{counts.attending}</td>
                    <td>{counts.declined}</td>
                    <td>{counts.pending}</td>
                    <td>{counts.maybe}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {stats.overall.assumedRecords > 0 && (
        <p className="hint">
          ב-{stats.overall.assumedRecords.toLocaleString('he-IL')} רשומות לא צוין מספר אנשים, והן נספרות כ-1 עד
          שתעדכנו אותן.
        </p>
      )}
    </section>
  )
}

import { sideLabel } from '../../domain/labels.ts'
import { sideSlices } from '../../domain/stats.ts'
import type { Guest } from '../../domain/types.ts'

export function SideSplit({ guests }: { guests: readonly Guest[] }) {
  const slices = sideSlices(guests)
  const total = slices.reduce((sum, slice) => sum + slice.people, 0)
  if (total === 0) return null
  const groom = slices[0]
  const bride = slices[1]
  const groomShare = Math.round((groom.people / total) * 100)
  const brideShare = 100 - groomShare

  return (
    <section className="side-panel" aria-label="פילוח חתן וכלה">
      <h2>חתן וכלה</h2>
      <div
        className="side-bar"
        role="img"
        aria-label={`חתן ${groom.people} אנשים, כלה ${bride.people} אנשים`}
      >
        {groom.people > 0 && <span className="side-bar-groom" style={{ width: `${groomShare}%` }} />}
        {bride.people > 0 && <span className="side-bar-bride" style={{ width: `${brideShare}%` }} />}
      </div>
      <div className="side-columns">
        {[groom, bride].map((slice, index) => (
          <div key={slice.side} className="side-col">
            <h3>
              <span className={index === 0 ? 'swatch swatch-groom' : 'swatch swatch-bride'} aria-hidden="true" />
              {sideLabel(slice.side)}
              <strong>{slice.people.toLocaleString('he-IL')}</strong>
              <span className="side-share">{index === 0 ? groomShare : brideShare}%</span>
            </h3>
            <ul>
              {slice.groups.map((group) => (
                <li key={group.label}>
                  <span>{group.label}</span>
                  <strong>{group.people.toLocaleString('he-IL')}</strong>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

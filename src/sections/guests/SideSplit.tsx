import { sideLabel } from '../../domain/labels.ts'
import { pieSlices } from '../../domain/stats.ts'
import type { Guest } from '../../domain/types.ts'

export function SideSplit({ guests }: { guests: readonly Guest[] }) {
  const slices = pieSlices(guests)
  const total = slices.reduce((sum, slice) => sum + slice.people, 0)
  if (total === 0) return null
  const radius = 15.9
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const groomPeople = slices.find((slice) => slice.side === 'groom')?.people ?? 0
  const bridePeople = slices.find((slice) => slice.side === 'bride')?.people ?? 0

  return (
    <section className="side-panel side-pie-panel" aria-label="פילוח חתן וכלה">
      <h2>חתן וכלה</h2>
      <div className="side-pie-layout">
        <svg className="side-pie" viewBox="0 0 42 42" role="img" aria-label={`${sideLabel('groom')} ${groomPeople}, ${sideLabel('bride')} ${bridePeople}`}>
          {slices.map((slice) => {
            const length = (slice.people / total) * circumference
            const dash = `${length} ${circumference - length}`
            const element = (
              <circle
                key={slice.key}
                r={radius}
                cx="21"
                cy="21"
                fill="transparent"
                stroke={slice.color}
                strokeWidth="10"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            )
            offset += length
            return element
          })}
        </svg>
        <ul className="side-pie-legend">
          <li className="side-pie-total">
            <span className="swatch swatch-groom" aria-hidden="true" />
            {sideLabel('groom')}
            <strong>{Math.round((groomPeople / total) * 100)}%</strong>
          </li>
          <li className="side-pie-total">
            <span className="swatch swatch-bride" aria-hidden="true" />
            {sideLabel('bride')}
            <strong>{Math.round((bridePeople / total) * 100)}%</strong>
          </li>
        </ul>
      </div>
    </section>
  )
}

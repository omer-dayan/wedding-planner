const PETAL_ANGLES = [0, 72, 144, 216, 288]

export function Flower({ className = 'flower' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 40 C31 48 30 54 32 61" fill="none" stroke="#2f6d4f" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="25.5" cy="51" rx="7.5" ry="3.6" fill="#6f9a7c" transform="rotate(-28 25.5 51)" />
      <ellipse cx="38.5" cy="49" rx="7.5" ry="3.6" fill="#8fb59a" transform="rotate(28 38.5 49)" />
      <g transform="translate(32 26)">
        {PETAL_ANGLES.map((angle) => (
          <ellipse key={angle} cx="0" cy="-11" rx="8" ry="12" fill="#f4b7c6" transform={`rotate(${angle})`} />
        ))}
        {PETAL_ANGLES.map((angle) => (
          <ellipse key={`in-${angle}`} cx="0" cy="-8" rx="4" ry="6.5" fill="#fbdde4" transform={`rotate(${angle})`} />
        ))}
        <circle r="6" fill="#f4e2ae" />
        <circle r="6" fill="none" stroke="#e0bf72" strokeWidth="1.2" />
      </g>
    </svg>
  )
}

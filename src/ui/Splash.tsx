import { Rings } from './Rings.tsx'

export function Splash({ label }: { label: string }) {
  return (
    <div className="splash" role="status">
      <Rings />
      <p>{label}</p>
    </div>
  )
}

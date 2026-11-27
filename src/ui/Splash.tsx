import { Flower } from './Flower.tsx'

export function Splash({ label }: { label: string }) {
  return (
    <div className="splash" role="status">
      <Flower className="flower flower-lg" />
      <p>{label}</p>
    </div>
  )
}

export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="fab" aria-label={label} onClick={onClick}>
      <span aria-hidden="true">+</span>
    </button>
  )
}

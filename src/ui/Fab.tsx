export function Fab({ label, onClick, testId }: { label: string; onClick: () => void; testId?: string }) {
  return (
    <button type="button" className="fab" aria-label={label} data-testid={testId} onClick={onClick}>
      <span aria-hidden="true">+</span>
    </button>
  )
}

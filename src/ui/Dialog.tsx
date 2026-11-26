import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) {
      element.dataset.programmaticClose = 'true'
      element.close()
    }
  }, [open])

  function handleClose() {
    const element = ref.current
    if (element?.dataset.programmaticClose === 'true') {
      delete element.dataset.programmaticClose
      return
    }
    onClose()
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={handleClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      <div className="dialog-card">
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="סגירה">
            ×
          </button>
        </div>
        <div className="dialog-body">{open ? children : null}</div>
      </div>
    </dialog>
  )
}

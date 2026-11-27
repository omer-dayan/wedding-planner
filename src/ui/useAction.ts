import { useState } from 'react'
import { messageFrom } from './messageFrom.ts'

/** Busy and error state for a button that saves something. `run` reports whether the action succeeded. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (failure) {
      setError(messageFrom(failure))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

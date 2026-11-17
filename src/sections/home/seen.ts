export function seenStorageKey(scope: string, email: string): string {
  return `wedding-planner.activity-seen.${scope}.${email.trim().toLowerCase() || 'local'}`
}

export function readLastSeen(scope: string, email: string): string | null {
  try {
    return localStorage.getItem(seenStorageKey(scope, email))
  } catch {
    return null
  }
}

export function markActivitySeen(scope: string, email: string, iso: string) {
  try {
    localStorage.setItem(seenStorageKey(scope, email), iso)
  } catch {
    // The badge can stay until the next visit.
  }
  window.dispatchEvent(new Event('activity-seen'))
}

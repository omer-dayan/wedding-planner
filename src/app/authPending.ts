export const AUTH_PENDING_KEY = 'wedding-planner.auth-pending'
export const AUTH_REDIRECT_KEY = 'wedding-planner.auth-redirect'

export function markAuthPending() {
  write(AUTH_PENDING_KEY)
}

export function markAuthRedirect() {
  write(AUTH_PENDING_KEY)
  write(AUTH_REDIRECT_KEY)
}

export function clearAuthFlow() {
  remove(AUTH_PENDING_KEY)
  remove(AUTH_REDIRECT_KEY)
}

export function isAuthFlowPending(): boolean {
  return read(AUTH_PENDING_KEY) === '1' || read(AUTH_REDIRECT_KEY) === '1'
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string) {
  try {
    sessionStorage.setItem(key, '1')
  } catch {
    // Private mode can reject storage. The sign-in attempt still proceeds.
  }
}

function remove(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Nothing else can clear the flag.
  }
}

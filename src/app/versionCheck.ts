import { isAuthFlowPending } from './authPending.ts'

export const VERSION_CHECK_GAP_MS = 60_000
export const RELOAD_GUARD_KEY = 'wedding-planner.reloaded-for'

export type ReloadDecision = 'reload' | 'clear' | 'stay'

export function parseVersion(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const id = (payload as { id?: unknown }).id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

export function reloadDecision(bundleId: string, remoteId: string | null, triedId: string | null): ReloadDecision {
  if (!remoteId) return 'stay'
  if (remoteId === bundleId) return 'clear'
  if (triedId === remoteId) return 'stay'
  return 'reload'
}

export function versionedUrl(pathname: string, hash: string, id: string): string {
  return `${pathname}?v=${encodeURIComponent(id)}${hash}`
}

export interface VersionCheck {
  bundleId: string
  baseUrl: string
  now: number
  lastCheck: number
  force: boolean
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  pathname: string
  hash: string
  replace: (url: string) => void
  allowReload?: () => boolean
}

export async function checkForUpdate(input: VersionCheck): Promise<{ lastCheck: number }> {
  if (!input.force && input.now - input.lastCheck < VERSION_CHECK_GAP_MS) return { lastCheck: input.lastCheck }
  const lastCheck = input.now
  let remoteId: string | null = null
  try {
    const response = await input.fetchImpl(`${input.baseUrl}version.json?t=${input.now}`, { cache: 'no-store' })
    if (response.ok) remoteId = parseVersion(await response.json())
  } catch {
    return { lastCheck }
  }
  const decision = reloadDecision(input.bundleId, remoteId, readGuard(input.storage))
  if (decision === 'clear') {
    try {
      input.storage.removeItem(RELOAD_GUARD_KEY)
    } catch {
      // Private mode can reject storage. The versions already match, so there is nothing to retry.
    }
  }
  if (decision === 'reload' && remoteId) {
    if (input.allowReload && !input.allowReload()) return { lastCheck }
    try {
      input.storage.setItem(RELOAD_GUARD_KEY, remoteId)
    } catch {
      // Continue. A storage failure can allow one extra reload, which the matching version then stops.
    }
    input.replace(versionedUrl(input.pathname, input.hash, remoteId))
  }
  return { lastCheck }
}

export async function unregisterServiceWorkers(nav: Navigator): Promise<void> {
  if (!('serviceWorker' in nav)) return
  const registrations = await nav.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))
}

export function startVersionCheck(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined
  void unregisterServiceWorkers(navigator).catch(() => undefined)
  const state = { lastCheck: Date.now() }
  const run = (force: boolean) => {
    void checkForUpdate({
      bundleId: __BUILD_ID__,
      baseUrl: import.meta.env.BASE_URL,
      now: Date.now(),
      lastCheck: state.lastCheck,
      force,
      fetchImpl: (input, init) => fetch(input, init),
      storage: sessionStorage,
      pathname: window.location.pathname,
      hash: window.location.hash,
      replace: (url) => window.location.replace(url),
      allowReload: () => !isAuthFlowPending(),
    }).then((result) => {
      state.lastCheck = result.lastCheck
    })
  }
  run(true)
  const onVisible = () => {
    if (document.visibilityState === 'visible') run(false)
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}

function readGuard(storage: Pick<Storage, 'getItem'>): string | null {
  try {
    return storage.getItem(RELOAD_GUARD_KEY)
  } catch {
    return null
  }
}

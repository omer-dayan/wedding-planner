import { describe, expect, it, vi } from 'vitest'
import {
  RELOAD_GUARD_KEY,
  VERSION_CHECK_GAP_MS,
  checkForUpdate,
  parseVersion,
  reloadDecision,
  unregisterServiceWorkers,
  versionedUrl,
  type VersionCheck,
} from './versionCheck.ts'

function harness(overrides: Partial<VersionCheck> = {}) {
  const storage = new Map<string, string>()
  const replace = vi.fn()
  const fetchImpl = vi.fn(async () => Response.json({ id: 'bbbbbbb' }))
  const input: VersionCheck = {
    bundleId: 'aaaaaaa',
    baseUrl: '/wedding-planner/',
    now: 1_000,
    lastCheck: 0,
    force: true,
    fetchImpl,
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => void storage.set(key, value),
      removeItem: (key) => void storage.delete(key),
    },
    pathname: '/wedding-planner/',
    hash: '#/music',
    replace,
    ...overrides,
  }
  return { input, storage, replace, fetchImpl }
}

describe('version check', () => {
  it('reloads once when the published build id changes', async () => {
    const { input, storage, replace, fetchImpl } = harness()
    await checkForUpdate(input)
    expect(fetchImpl).toHaveBeenCalledWith('/wedding-planner/version.json?t=1000', { cache: 'no-store' })
    expect(replace).toHaveBeenCalledWith('/wedding-planner/?v=bbbbbbb#/music')
    expect(storage.get(RELOAD_GUARD_KEY)).toBe('bbbbbbb')
    expect(versionedUrl('/wedding-planner/', '#/guests', 'abc 123')).toBe('/wedding-planner/?v=abc%20123#/guests')
  })

  it('does not reload again for the same build id', async () => {
    const { input, replace } = harness()
    input.storage.setItem(RELOAD_GUARD_KEY, 'bbbbbbb')
    await checkForUpdate(input)
    expect(replace).not.toHaveBeenCalled()
    expect(reloadDecision('aaaaaaa', 'bbbbbbb', 'bbbbbbb')).toBe('stay')
  })

  it('clears the guard when the running bundle matches', async () => {
    const { input, storage, replace } = harness()
    storage.set(RELOAD_GUARD_KEY, 'old')
    input.fetchImpl = vi.fn(async () => Response.json({ id: 'aaaaaaa' }))
    await checkForUpdate(input)
    expect(replace).not.toHaveBeenCalled()
    expect(storage.has(RELOAD_GUARD_KEY)).toBe(false)
    expect(parseVersion({ id: '  abc1234  ' })).toBe('abc1234')
    expect(parseVersion({})).toBeNull()
  })

  it('throttles a visible check and still allows the first one', async () => {
    const { input, fetchImpl } = harness({ force: false, lastCheck: 1_000, now: 1_000 + VERSION_CHECK_GAP_MS - 1 })
    await checkForUpdate(input)
    expect(fetchImpl).not.toHaveBeenCalled()
    await checkForUpdate({ ...input, force: true })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('stays put when the version file cannot be read', async () => {
    const { input, replace } = harness()
    input.fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    })
    const failed = await checkForUpdate(input)
    expect(failed.lastCheck).toBe(1_000)
    expect(replace).not.toHaveBeenCalled()
  })

  it('unregisters existing service workers', async () => {
    const unregister = vi.fn(async () => true)
    const nav = {
      serviceWorker: { getRegistrations: async () => [{ unregister }] },
    } as unknown as Navigator
    await unregisterServiceWorkers(nav)
    expect(unregister).toHaveBeenCalledOnce()
  })
})

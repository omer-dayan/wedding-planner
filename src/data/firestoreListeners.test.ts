import { describe, expect, it } from 'vitest'
import {
  PERMISSION_DENIED_BACKOFF_MS,
  isCommittedServerSnapshot,
  isPermissionDenied,
  nextPermissionRetryDelay,
} from './firestoreListeners.ts'

describe('isCommittedServerSnapshot', () => {
  it('accepts a server snapshot that has no local writes waiting', () => {
    expect(isCommittedServerSnapshot({ hasPendingWrites: false, fromCache: false })).toBe(true)
  })

  it('ignores a local pending write and a cached copy', () => {
    expect(isCommittedServerSnapshot({ hasPendingWrites: true, fromCache: false })).toBe(false)
    expect(isCommittedServerSnapshot({ hasPendingWrites: false, fromCache: true })).toBe(false)
    expect(isCommittedServerSnapshot({ hasPendingWrites: true, fromCache: true })).toBe(false)
  })
})

describe('guest listen retries', () => {
  it('backs off four times on permission-denied, then stops', () => {
    expect(PERMISSION_DENIED_BACKOFF_MS).toEqual([300, 800, 2_000, 4_000])
    expect(nextPermissionRetryDelay(0, { code: 'permission-denied' })).toBe(300)
    expect(nextPermissionRetryDelay(1, { code: 'firestore/permission-denied' })).toBe(800)
    expect(nextPermissionRetryDelay(2, { code: 'permission-denied' })).toBe(2_000)
    expect(nextPermissionRetryDelay(3, { code: 'permission-denied' })).toBe(4_000)
    expect(nextPermissionRetryDelay(4, { code: 'permission-denied' })).toBeNull()
  })

  it('does not retry other errors', () => {
    expect(isPermissionDenied({ code: 'unavailable' })).toBe(false)
    expect(nextPermissionRetryDelay(0, { code: 'unavailable' })).toBeNull()
    expect(nextPermissionRetryDelay(0, new Error('permission-denied'))).toBeNull()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { isQuietAuthError, shouldUseRedirect, signInWithGoogle } from './firebaseBackend.ts'
import { isAuthFlowPending } from '../app/authPending.ts'
import { mapAuthError } from '../ui/messageFrom.ts'
import type { Auth } from 'firebase/auth'

function memorySession() {
  const values = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
}

describe('Google sign-in', () => {
  it('opens a popup immediately and does not redirect', async () => {
    memorySession()
    const order: string[] = []
    const popup = vi.fn(() => {
      order.push(isAuthFlowPending() ? 'popup-while-pending' : 'popup')
      return Promise.resolve({ user: { email: 'a@example.com' } })
    })
    const redirect = vi.fn(() => Promise.resolve())
    await signInWithGoogle({} as Auth, { popup, redirect })
    expect(order).toEqual(['popup-while-pending'])
    expect(redirect).not.toHaveBeenCalled()
    expect(isAuthFlowPending()).toBe(false)
  })

  it('falls back to redirect only when the popup cannot open', async () => {
    memorySession()
    const popup = vi.fn(() => Promise.reject({ code: 'auth/popup-blocked' }))
    const redirect = vi.fn(() => Promise.resolve())
    await signInWithGoogle({} as Auth, { popup, redirect })
    expect(redirect).toHaveBeenCalledOnce()
    expect(isAuthFlowPending()).toBe(true)
    expect(shouldUseRedirect('auth/operation-not-supported-in-this-environment')).toBe(true)
    expect(shouldUseRedirect('auth/network-request-failed')).toBe(false)
  })

  it('ignores a closed popup and explains a lost redirect', async () => {
    memorySession()
    const popup = vi.fn(() => Promise.reject({ code: 'auth/popup-closed-by-user' }))
    const redirect = vi.fn()
    await signInWithGoogle({} as Auth, { popup, redirect })
    expect(redirect).not.toHaveBeenCalled()
    expect(isAuthFlowPending()).toBe(false)
    expect(isQuietAuthError('auth/cancelled-popup-request')).toBe(true)
    expect(mapAuthError(new Error('Unable to process request due to missing initial state. storage-partitioned browser'))).toBe('auth-storage')
  })
})

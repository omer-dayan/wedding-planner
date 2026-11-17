import { DomainError, ValidationError } from '../domain/errors.ts'
import { errorText } from '../domain/labels.ts'

export function firebaseCode(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error) return String((error as { code: unknown }).code)
  return ''
}

export function mapFirebaseCode(code: string, message = ''): string {
  const text = `${code} ${message}`.toLowerCase()
  if (text.includes('popup-closed') || text.includes('cancelled-popup')) return 'popup-closed'
  if (text.includes('missing initial state') || text.includes('storage-partitioned') || text.includes('sessionstorage')) return 'auth-storage'
  if (text.includes('popup-blocked')) return 'popup-blocked'
  if (text.includes('unauthorized-domain')) return 'unauthorized-domain'
  if (text.includes('network-request-failed')) return 'network-auth'
  if (text.includes('permission-denied')) return 'permission-denied'
  if (!code && !message) return 'unknown'
  return 'auth-failed'
}

export function mapAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return mapFirebaseCode(firebaseCode(error), message)
}

export function messageFrom(error: unknown): string {
  if (error instanceof ValidationError) return errorText(error.errors[0] ?? 'unknown')
  if (error instanceof DomainError) return errorText(error.code)
  const mapped = mapAuthError(error)
  if (mapped === 'popup-closed') return ''
  return errorText(mapped)
}

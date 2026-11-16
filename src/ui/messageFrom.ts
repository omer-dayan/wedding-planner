import { DomainError, ValidationError } from '../domain/errors.ts'
import { errorText } from '../domain/labels.ts'

export function firebaseCode(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error) return String((error as { code: unknown }).code)
  return ''
}

export function mapFirebaseCode(code: string): string {
  if (code.includes('popup-blocked')) return 'popup-blocked'
  if (code.includes('unauthorized-domain')) return 'unauthorized-domain'
  if (code.includes('network-request-failed')) return 'network-auth'
  if (code.includes('permission-denied')) return 'permission-denied'
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return 'popup-closed'
  if (!code) return 'unknown'
  return 'auth-failed'
}

export function messageFrom(error: unknown): string {
  if (error instanceof ValidationError) return errorText(error.errors[0] ?? 'unknown')
  if (error instanceof DomainError) return errorText(error.code)
  const mapped = mapFirebaseCode(firebaseCode(error))
  if (mapped === 'popup-closed') return ''
  return errorText(mapped)
}

import { DomainError } from './errors.ts'
import type { WeddingRoleId } from './roles.ts'

export interface Wedding {
  id: string
  name: string
  ownerEmail: string
  memberEmails: string[]
  memberRoles: Record<string, WeddingRoleId>
  weddingDate: string
  createdAt: string
  updatedAt: string
}

export interface MemberView {
  email: string
  role: 'owner' | 'member'
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

export function emailVariants(email: string): string[] {
  const trimmed = email.trim()
  const lower = trimmed.toLowerCase()
  return trimmed === lower ? [trimmed] : [trimmed, lower]
}

export function normalizeWeddingDate(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new DomainError('invalid-date')
  return trimmed
}

export function normalizeWeddingName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) throw new DomainError('invalid-name')
  if (trimmed.length > 80) throw new DomainError('name-too-long')
  return trimmed
}

export function addMemberEmail(memberEmails: readonly string[], ownerEmail: string, nextEmail: string): string[] {
  const trimmed = nextEmail.trim()
  if (!isEmail(trimmed)) throw new DomainError('invalid-email')
  const merged = [...memberEmails]
  let added = false
  for (const variant of emailVariants(trimmed)) {
    if (!merged.some((email) => email.toLowerCase() === variant.toLowerCase())) {
      merged.push(variant)
      added = true
    }
  }
  for (const variant of emailVariants(ownerEmail)) {
    if (!merged.some((email) => email.toLowerCase() === variant.toLowerCase())) merged.push(variant)
  }
  if (!added) throw new DomainError('already-member')
  if (new Set(merged.map((email) => email.toLowerCase())).size > 20) throw new DomainError('too-many-members')
  return merged
}

export function removeMemberEmail(memberEmails: readonly string[], ownerEmail: string, email: string): string[] {
  if (email.trim().toLowerCase() === ownerEmail.trim().toLowerCase()) {
    throw new DomainError('cannot-remove-owner')
  }
  const next = memberEmails.filter((entry) => entry.toLowerCase() !== email.trim().toLowerCase())
  for (const variant of emailVariants(ownerEmail)) {
    if (!next.some((email) => email.toLowerCase() === variant.toLowerCase())) next.push(variant)
  }
  return next
}

export function displayMembers(memberEmails: readonly string[], ownerEmail: string): MemberView[] {
  const byKey = new Map<string, string>()
  for (const email of memberEmails) byKey.set(email.toLowerCase(), email)
  byKey.set(ownerEmail.toLowerCase(), ownerEmail)
  return [...byKey.entries()]
    .map(([key, email]) => ({
      email: key === ownerEmail.toLowerCase() ? ownerEmail : email,
      role: key === ownerEmail.toLowerCase() ? ('owner' as const) : ('member' as const),
    }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
      return a.email.localeCompare(b.email, 'he')
    })
}

export function chooseWedding(weddings: readonly Wedding[], preferredId: string | null, userEmail: string): Wedding | null {
  if (weddings.length === 0) return null
  if (preferredId) {
    const preferred = weddings.find((wedding) => wedding.id === preferredId)
    if (preferred) return preferred
  }

  const me = userEmail.trim().toLowerCase()
  const shared = weddings.filter((wedding) => uniqueEmails(wedding.memberEmails).size > 1)
  if (shared.length === 1) return shared[0]
  const owned = weddings.find((wedding) => wedding.ownerEmail.toLowerCase() === me)
  if (owned && shared.length === 0) return owned
  if (shared.length > 0) return shared[0]
  return owned ?? weddings[0]
}

function uniqueEmails(emails: readonly string[]): Set<string> {
  return new Set(emails.map((email) => email.toLowerCase()))
}

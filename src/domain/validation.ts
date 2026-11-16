import { ValidationError } from './errors.ts'
import { isWeddingRole, sideForRole } from './roles.ts'
import { isRsvp, isSide } from './types.ts'
import type { Guest, GuestDraft } from './types.ts'

export function collapseSpaces(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ')
}

export function normalizeName(name: string): string {
  return collapseSpaces(name).toLocaleLowerCase('he')
}

export function normalizeDraft(input: GuestDraft): GuestDraft {
  const fullName = collapseSpaces(input.fullName)
  const phone = input.phone.trim()
  const group = collapseSpaces(input.group)
  const notes = input.notes.trim()
  const errors: string[] = []

  if (!fullName) errors.push('name-required')
  if (fullName.length > 200) errors.push('name-length')
  if (phone.length > 40) errors.push('phone-length')
  if (group.length > 160) errors.push('group-length')
  if (notes.length > 2000) errors.push('notes-length')
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 100) {
    errors.push('party-size')
  }
  const role = isWeddingRole(input.role) ? input.role : null
  if (input.role !== null && !role) errors.push('role')
  const side = role ? sideForRole(role) : input.side
  if (side !== null && !isSide(side)) errors.push('side')
  if (!isRsvp(input.rsvp)) errors.push('rsvp')
  if (typeof input.partySizeAssumed !== 'boolean') errors.push('assumed')
  if (errors.length > 0) throw new ValidationError(errors)

  return {
    fullName,
    phone,
    side,
    role,
    group,
    partySize: input.partySize,
    partySizeAssumed: input.partySizeAssumed,
    rsvp: input.rsvp,
    notes,
  }
}

export function parseStoredGuest(value: unknown): Guest | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) return null

  const side = record.side === null || record.side === undefined || record.side === '' ? null : record.side
  let draft: GuestDraft
  try {
    draft = normalizeDraft({
      fullName: typeof record.fullName === 'string' ? record.fullName : '',
      phone: typeof record.phone === 'string' ? record.phone : '',
      side: side as GuestDraft['side'],
      group: typeof record.group === 'string' ? record.group : '',
      partySize: typeof record.partySize === 'number' ? record.partySize : Number.NaN,
      partySizeAssumed: record.partySizeAssumed === true,
      rsvp: (typeof record.rsvp === 'string' ? record.rsvp : '') as GuestDraft['rsvp'],
      notes: typeof record.notes === 'string' ? record.notes : '',
      role: isWeddingRole(record.role) ? record.role : null,
    })
  } catch {
    return null
  }

  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString()
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : createdAt
  return { id: record.id, ...draft, createdAt, updatedAt }
}

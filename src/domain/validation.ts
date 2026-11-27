import { ValidationError } from './errors.ts'
import { isWeddingRole } from './roles.ts'
import { isCategory, isRsvp, isSide, isSubSide } from './types.ts'
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
  for (const count of [input.childrenSmall, input.childrenOlder]) {
    if (!Number.isInteger(count) || count < 0 || count > 100) errors.push('child-count')
  }
  if (!Number.isInteger(input.drinkerCount) || input.drinkerCount < 0 || input.drinkerCount > input.partySize) {
    errors.push('drinker-count')
  }
  const role = isWeddingRole(input.role) ? input.role : null
  if (input.role !== null && !role) errors.push('role')
  const side = input.side
  if (side !== null && !isSide(side)) errors.push('side')
  if (!isSubSide(input.subSide)) errors.push('sub-side')
  if (!isCategory(input.category)) errors.push('category')
  if (!isRsvp(input.rsvp)) errors.push('rsvp')
  if (typeof input.partySizeAssumed !== 'boolean') errors.push('assumed')
  if (errors.length > 0) throw new ValidationError(errors)

  return {
    fullName,
    phone,
    side,
    subSide: input.subSide,
    category: input.category,
    categoryId: input.categoryId.trim(),
    role,
    group,
    partySize: input.partySize,
    childrenSmall: input.childrenSmall,
    childrenOlder: input.childrenOlder,
    drinkerCount: input.drinkerCount,
    partySizeAssumed: input.partySizeAssumed,
    rsvp: input.rsvp,
    notes,
  }
}

function wholeCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0
}

/** Guests saved before children were split by age keep their old total in the older group. */
function storedChildren(record: Record<string, unknown>): { childrenSmall: number; childrenOlder: number } {
  if (record.childrenSmall === undefined && record.childrenOlder === undefined) {
    return { childrenSmall: 0, childrenOlder: wholeCount(record.childCount) }
  }
  return { childrenSmall: wholeCount(record.childrenSmall), childrenOlder: wholeCount(record.childrenOlder) }
}

function storedDrinkers(value: unknown, partySize: number): number {
  const count = typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0
  if (!Number.isInteger(partySize) || partySize < 1) return 0
  return Math.min(count, partySize)
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
      subSide: isSubSide(record.subSide) ? record.subSide : 'none',
      category: isCategory(record.category) ? record.category : 'other',
      categoryId: typeof record.categoryId === 'string' ? record.categoryId : '',
      group: typeof record.group === 'string' ? record.group : '',
      partySize: typeof record.partySize === 'number' ? record.partySize : Number.NaN,
      ...storedChildren(record),
      drinkerCount: storedDrinkers(record.drinkerCount, typeof record.partySize === 'number' ? record.partySize : 0),
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

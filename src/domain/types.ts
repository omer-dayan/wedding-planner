import type { WeddingRoleId } from './roles.ts'

export const SIDES = ['groom', 'bride', 'shared'] as const
export type Side = (typeof SIDES)[number]

export const SUB_SIDES = ['none', 'parents', 'brother', 'sister'] as const
export type SubSide = (typeof SUB_SIDES)[number]

export const CATEGORIES = ['family', 'friends', 'work', 'other'] as const
export type Category = (typeof CATEGORIES)[number]

export const RSVP_STATUSES = ['pending', 'attending', 'declined', 'maybe'] as const
export type RsvpStatus = (typeof RSVP_STATUSES)[number]

export interface GuestDraft {
  fullName: string
  phone: string
  side: Side | null
  subSide: SubSide
  category: Category
  /** Id in the wedding's guest category tree. Empty when the guest is not in a category yet. */
  categoryId: string
  role: WeddingRoleId | null
  group: string
  partySize: number
  partySizeAssumed: boolean
  rsvp: RsvpStatus
  notes: string
}

export interface Guest extends GuestDraft {
  id: string
  createdAt: string
  updatedAt: string
}

export type { WeddingRoleId } from './roles.ts'

export function isSide(value: unknown): value is Side {
  return typeof value === 'string' && (SIDES as readonly string[]).includes(value)
}

export function isSubSide(value: unknown): value is SubSide {
  return typeof value === 'string' && (SUB_SIDES as readonly string[]).includes(value)
}

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

export function isRsvp(value: unknown): value is RsvpStatus {
  return typeof value === 'string' && (RSVP_STATUSES as readonly string[]).includes(value)
}

export const SIDES = ['groom', 'bride', 'shared'] as const
export type Side = (typeof SIDES)[number]

export const RSVP_STATUSES = ['pending', 'attending', 'declined', 'maybe'] as const
export type RsvpStatus = (typeof RSVP_STATUSES)[number]

export interface GuestDraft {
  fullName: string
  phone: string
  side: Side | null
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

export function isSide(value: unknown): value is Side {
  return typeof value === 'string' && (SIDES as readonly string[]).includes(value)
}

export function isRsvp(value: unknown): value is RsvpStatus {
  return typeof value === 'string' && (RSVP_STATUSES as readonly string[]).includes(value)
}

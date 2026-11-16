import type { Guest, RsvpStatus, Side } from './types.ts'

export interface StatusCounts {
  records: number
  people: number
  attending: number
  declined: number
  pending: number
  maybe: number
  assumedRecords: number
}

export type SideKey = Side | 'unspecified'

export interface GuestStats {
  overall: StatusCounts
  bySide: Record<SideKey, StatusCounts>
}

export function emptyCounts(): StatusCounts {
  return {
    records: 0,
    people: 0,
    attending: 0,
    declined: 0,
    pending: 0,
    maybe: 0,
    assumedRecords: 0,
  }
}

export function summarizeGuests(guests: readonly Guest[]): GuestStats {
  const bySide: Record<SideKey, StatusCounts> = {
    groom: emptyCounts(),
    bride: emptyCounts(),
    shared: emptyCounts(),
    unspecified: emptyCounts(),
  }
  const overall = emptyCounts()
  for (const guest of guests) {
    addCounts(overall, guest)
    addCounts(bySide[guest.side ?? 'unspecified'], guest)
  }
  return { overall, bySide }
}

function addCounts(bucket: StatusCounts, guest: Guest) {
  bucket.records += 1
  bucket.people += guest.partySize
  bucket[guest.rsvp satisfies RsvpStatus] += guest.partySize
  if (guest.partySizeAssumed) bucket.assumedRecords += 1
}

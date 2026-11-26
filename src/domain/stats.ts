import { categoryById, type GuestCategory } from './guestCategories.ts'
import { CATEGORY_LABELS } from './labels.ts'
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

const GROUP_RANK = ['משפחה גרעינית', 'משפחה', 'חברים', 'עבודה']

export interface SideSlice {
  side: 'groom' | 'bride'
  people: number
  groups: { label: string; people: number }[]
}

export function sideSlices(
  guests: readonly Pick<Guest, 'side' | 'partySize' | 'group' | 'category' | 'categoryId'>[],
  categories: readonly GuestCategory[] = [],
): SideSlice[] {
  return (['groom', 'bride'] as const).map((side) => {
    const mine = guests.filter((guest) => guest.side === side)
    const groups = new Map<string, number>()
    for (const guest of mine) {
      const label = categoryById(categories, guest.categoryId)?.label || guest.group.trim() || CATEGORY_LABELS[guest.category]
      groups.set(label, (groups.get(label) ?? 0) + guest.partySize)
    }
    return {
      side,
      people: mine.reduce((sum, guest) => sum + guest.partySize, 0),
      groups: [...groups.entries()]
        .sort((left, right) => rank(left[0]) - rank(right[0]))
        .map(([label, people]) => ({ label, people })),
    }
  })
}

function rank(label: string): number {
  const index = GROUP_RANK.indexOf(label)
  return index === -1 ? GROUP_RANK.length : index
}

function addCounts(bucket: StatusCounts, guest: Guest) {
  bucket.records += 1
  bucket.people += guest.partySize
  bucket[guest.rsvp satisfies RsvpStatus] += guest.partySize
  if (guest.partySizeAssumed) bucket.assumedRecords += 1
}

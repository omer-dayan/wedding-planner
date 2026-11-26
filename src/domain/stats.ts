import { categoryById, type GuestCategory } from './guestCategories.ts'
import { CATEGORY_LABELS } from './labels.ts'
import { guestPeople, type Guest, type RsvpStatus, type Side } from './types.ts'

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

export interface PieSlice {
  key: string
  label: string
  side: 'groom' | 'bride'
  people: number
  color: string
}

const SIDE_HUE = { groom: 152, bride: 12 } as const

export function pieSlices(
  guests: readonly Pick<Guest, 'side' | 'partySize' | 'childCount' | 'group' | 'category' | 'categoryId'>[],
  categories: readonly GuestCategory[] = [],
): PieSlice[] {
  return sideSlices(guests, categories).flatMap((slice) => {
    const count = Math.max(slice.groups.length, 1)
    return slice.groups.map((group, index) => ({
      key: `${slice.side}:${group.label}`,
      label: group.label,
      side: slice.side,
      people: group.people,
      color: shade(SIDE_HUE[slice.side], count, index),
    }))
  }).filter((slice) => slice.people > 0)
}

function shade(hue: number, count: number, index: number): string {
  const lightness = 28 + (index * 36) / count
  const saturation = hue === SIDE_HUE.bride ? 42 : 28
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

export function sideSlices(
  guests: readonly Pick<Guest, 'side' | 'partySize' | 'childCount' | 'group' | 'category' | 'categoryId'>[],
  categories: readonly GuestCategory[] = [],
): SideSlice[] {
  return (['groom', 'bride'] as const).map((side) => {
    const mine = guests.filter((guest) => guest.side === side)
    const groups = new Map<string, number>()
    for (const guest of mine) {
      const label = categoryById(categories, guest.categoryId)?.label || guest.group.trim() || CATEGORY_LABELS[guest.category]
      groups.set(label, (groups.get(label) ?? 0) + guestPeople(guest))
    }
    return {
      side,
      people: mine.reduce((sum, guest) => sum + guestPeople(guest), 0),
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
  bucket.people += guestPeople(guest)
  bucket[guest.rsvp satisfies RsvpStatus] += guestPeople(guest)
  if (guest.partySizeAssumed) bucket.assumedRecords += 1
}
